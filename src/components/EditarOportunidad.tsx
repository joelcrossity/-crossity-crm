'use client'

import { useEffect, useState, useTransition } from 'react'
import { editarProyecto, guardarPropuesta, leerPropuesta } from '@/app/acciones'
import type { EtapaPropuesta } from '@/app/acciones'
import Cotizador from '@/components/Cotizador'
import ElegirCliente, { type Cliente } from '@/components/ElegirCliente'
import ElegirPersona from '@/components/ElegirPersona'
import { GRUPOS } from '@/lib/pipeline'

/* ------------------------------------------------------------------
   Editar una oportunidad sin entrar a la ficha.

   Es el mismo gesto que el lápiz de los proyectos y por las mismas
   razones: corregir un monto o cambiar el responsable desde el tablero
   son diez segundos, y hacerlo entrando y saliendo son cuatro
   navegaciones.

   Lo que agrega respecto del de proyectos es la cotización. Una
   oportunidad se edita sobre todo para eso: sube un número, se suma una
   etapa, el cliente pide sacar una. Tenerlo acá es tener el trabajo
   completo en un lugar.

   Se guarda con un botón y no campo por campo. En una cotización los
   cambios se piensan juntos —si subo la etapa 2 capaz bajo la 3— y
   guardar cada tecla iría dejando totales que nadie acordó.
   ------------------------------------------------------------------ */

export type Oportunidad = {
  id: string
  codigo: string
  nombre: string
  organizacion_id: string
  cliente: string
  responsable_id: string | null
  monto_neto: number | null
  moneda: string
  casa_cotizacion: string
  cotizacion_pactada: number | null
  etapa: string | null
  descripcion: string | null
}

export default function EditarOportunidad({
  op,
  clientes,
  personas,
  etapasPipeline,
  cotizaciones,
  alCerrar,
}: {
  op: Oportunidad
  clientes: Cliente[]
  personas: { id: string; nombre: string }[]
  etapasPipeline: { valor: string; etiqueta: string }[]
  /* Las del día, para mostrar el equivalente en pesos mientras se
     cotiza en dólares. */
  cotizaciones: { casa: string; venta: number }[]
  alCerrar: () => void
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [v, setV] = useState({
    nombre: op.nombre,
    organizacion_id: op.organizacion_id,
    clienteNuevo: '',
    cuitNuevo: '',
    responsable_id: op.responsable_id ?? '',
    moneda: op.moneda,
    casa: op.casa_cotizacion,
    pactada: op.cotizacion_pactada != null ? String(op.cotizacion_pactada) : '',
    etapa: op.etapa ?? '',
    descripcion: op.descripcion ?? '',
  })
  const [etapas, setEtapas] = useState<EtapaPropuesta[]>([])
  /* Hasta que llegan las etapas no se puede guardar. Guardar con la
     lista vacía borraría la cotización entera: el guardado reemplaza lo
     que hay por lo que se manda, y lo que se manda todavía no se leyó. */
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    /* Y se tira el resguardo que pudiera haber quedado de antes: sacar
       la función no borra lo que ya está en la máquina de cada uno, y
       son montos de clientes. */
    try {
      window.localStorage.removeItem(`borrador:oportunidad:${op.id}`)
    } catch {
      // Sin permiso para tocar el almacenamiento no hay nada guardado.
    }

    let vivo = true
    leerPropuesta(op.id).then((r) => {
      if (!vivo) return
      if (r.ok) setEtapas(r.etapas)
      else setError(r.error)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [op.id])

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [alCerrar])

  /* Mientras se prospecta no hay nada que cotizar: se está entendiendo
     qué necesita. Mostrar moneda, dólar y cotización por etapas en ese
     momento es pedir once decisiones para anotar que alguien llamó, y
     así es como se termina no anotando nada.

     Aparecen al pasar a propuesta, que es cuando existen de verdad. El
     selector de etapa está dos renglones arriba, así que si hace falta
     antes se cambia la etapa y aparecen: no hay nada trabado, solo
     guardado hasta que sirve. */
  const enProspeccion = GRUPOS[0].etapas.includes(v.etapa)

  const delDia = cotizaciones.find((c) => c.casa === v.casa)?.venta ?? null
  const cotizacion =
    v.casa === 'pactado' ? Number(v.pactada) || null : delDia

  function guardar() {
    setError(null)
    empezar(async () => {
      /* Primero la ficha y después las etapas: si algo falla, que falle
         antes de tocar la cotización, que es lo que más duele rehacer. */
      const cambios: Record<string, unknown> = {}
      if (v.nombre !== op.nombre) cambios.nombre = v.nombre.trim()
      if (v.organizacion_id !== op.organizacion_id && v.organizacion_id !== 'nuevo')
        cambios.organizacion_id = v.organizacion_id
      if (v.responsable_id !== (op.responsable_id ?? ''))
        cambios.responsable_id = v.responsable_id || null
      if (v.etapa !== (op.etapa ?? '') && v.etapa) cambios.etapa = v.etapa
      if (v.descripcion !== (op.descripcion ?? '')) cambios.descripcion = v.descripcion || null

      if (Object.keys(cambios).length > 0) {
        const r = await editarProyecto(op.id, cambios)
        if (!r.ok) return setError(r.error)
      }

      /* La moneda y el dólar del encabezado bajan a todas las cuotas:
         cotizar una etapa en dólares y otra en pesos dentro de la misma
         propuesta no es algo que pase, y dejarlo posible obligaría a
         elegirlo renglón por renglón. */
      const s = await guardarPropuesta(
        op.id,
        etapas.map((e) => ({
          ...e,
          componentes: e.componentes.map((c) => ({ ...c, moneda: v.moneda })),
          cuotas: e.cuotas.map((q) => ({
            ...q,
            moneda: v.moneda,
            casa: v.casa,
            cotizacion: v.casa === 'pactado' ? Number(v.pactada) || null : null,
          })),
        })),
      )
      if (!s.ok) return setError(s.error)

      alCerrar()
    })
  }

  return (
    <div className="fixed inset-0 z-(--z-modal) flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={alCerrar}
        className="absolute inset-0 bg-tinta/15 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${op.nombre}`}
        className="entra-de-costado relative flex h-full w-full max-w-lg flex-col border-l
                   border-linea bg-superficie shadow-[var(--sombra-flotante)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-linea px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="rotulo">Oportunidad · {op.codigo}</span>
            <h2 className="truncate text-base font-bold tracking-tight text-tinta">{op.nombre}</h2>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar"
            className="shrink-0 text-lg leading-none text-gris-50 transition-colors
                       duration-150 hover:text-tinta"
          >
            ×
          </button>
        </header>

        <div className="riel flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
          <label className="flex flex-col gap-0.5">
            <span className="rotulo">Nombre</span>
            <input
              value={v.nombre}
              onChange={(e) => setV({ ...v, nombre: e.target.value })}
              className="campo w-full"
            />
          </label>

          <div className="flex flex-col gap-0.5">
            <span className="rotulo">Cliente</span>
            <ElegirCliente
              clientes={clientes}
              elegido={v.organizacion_id}
              nombreNuevo={v.clienteNuevo}
              cuitNuevo={v.cuitNuevo}
              alElegir={(id) => setV({ ...v, organizacion_id: id })}
              alEscribirNuevo={(n) => setV({ ...v, clienteNuevo: n })}
              alEscribirCuit={(c) => setV({ ...v, cuitNuevo: c })}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Etapa</span>
              <select
                value={v.etapa}
                onChange={(e) => setV({ ...v, etapa: e.target.value })}
                className="campo w-full cursor-pointer"
              >
                {etapasPipeline.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <ElegirPersona
              personas={personas}
              elegida={v.responsable_id}
              alElegir={(id) => setV({ ...v, responsable_id: id })}
              etiqueta="Responsable"
            />
          </div>

          {enProspeccion && (
            <p className="border-t border-linea pt-3.5 text-2xs text-gris-50">
              La moneda y la cotización aparecen al pasarla a propuesta. Todavía no hay número: se
              está entendiendo qué necesita.
            </p>
          )}

          <div
            className={`flex-wrap items-end gap-3 border-t border-linea pt-3.5 ${
              enProspeccion ? 'hidden' : 'flex'
            }`}
          >
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Moneda</span>
              <select
                value={v.moneda}
                onChange={(e) => setV({ ...v, moneda: e.target.value })}
                className="campo w-28 cursor-pointer"
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>

            {/* Solo si hay algo que convertir: un selector que no hace
                nada es un selector que confunde. */}
            {v.moneda !== 'ARS' && (
              <label className="flex flex-col gap-0.5">
                <span className="rotulo">Se valúa al</span>
                <select
                  value={v.casa}
                  onChange={(e) => setV({ ...v, casa: e.target.value })}
                  className="campo w-32 cursor-pointer"
                >
                  <option value="oficial">Oficial</option>
                  <option value="blue">Blue</option>
                  <option value="pactado">Pactado</option>
                </select>
              </label>
            )}

            {v.moneda !== 'ARS' && v.casa === 'pactado' && (
              <label className="flex flex-col gap-0.5">
                <span className="rotulo">A cuánto</span>
                <input
                  value={v.pactada}
                  inputMode="decimal"
                  onChange={(e) => setV({ ...v, pactada: e.target.value })}
                  placeholder="1450"
                  className="campo cifra w-28"
                />
              </label>
            )}

            {v.moneda !== 'ARS' && v.casa !== 'pactado' && delDia && (
              <span className="cifra pb-2 text-2xs text-gris-50">hoy ${delDia.toLocaleString('es-AR')}</span>
            )}
          </div>

          <div className={enProspeccion ? 'hidden' : 'border-t border-linea pt-3.5'}>
            <Cotizador
              etapas={etapas}
              alCambiar={setEtapas}
              moneda={v.moneda}
              cotizacion={cotizacion}
            />
          </div>

          <label className="flex flex-col gap-0.5 border-t border-linea pt-3.5">
            <span className="rotulo">Notas</span>
            <textarea
              value={v.descripcion}
              onChange={(e) => setV({ ...v, descripcion: e.target.value })}
              rows={3}
              placeholder="Lo que haya que recordar de esta conversación."
              className="campo w-full resize-y"
            />
          </label>
        </div>

        <footer className="flex flex-col gap-2 border-t border-linea px-5 py-3">
          {error && (
            <p role="alert" className="text-2xs text-rojo">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={pendiente || cargando}
              className="boton boton-principal flex-1 justify-center"
            >
              {cargando ? 'Cargando…' : pendiente ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" onClick={alCerrar} className="boton boton-sutil">
              Cancelar
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

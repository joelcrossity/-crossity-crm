'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { editarProyecto, type CamposProyecto } from '@/app/acciones'
import ElegirCliente, { type Cliente } from '@/components/ElegirCliente'

/* ------------------------------------------------------------------
   Editar una ficha sin entrar a la ficha.

   Desde el tablero, cambiar la fecha de entrega obligaba a abrir el
   proyecto, buscar el campo entre veinte, cambiarlo y volver. Para una
   corrección de diez segundos son cuatro navegaciones.

   Va como panel lateral y no como modal centrado a propósito: un modal
   tapa el tablero y te saca de dónde estabas. El panel deja las
   columnas a la vista, así que se entiende que estás editando una
   tarjeta de las que se ven detrás y no en otra pantalla.

   Se guarda todo junto con un botón, no campo por campo al salir del
   input como en la ficha. Son dos gestos distintos: en la ficha estás
   trabajando sobre un proyecto y cada cambio es una decisión tomada;
   acá estás corrigiendo algo de paso y querés revisar antes de soltar.
   ------------------------------------------------------------------ */

export type Ficha = {
  id: string
  nombre: string
  organizacion_id: string
  responsable_id: string | null
  fecha_inicio: string | null
  fecha_comprometida: string | null
  monto_neto: number | null
  descripcion: string | null
  etapa: string | null
}

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string
  ayuda?: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="rotulo">{etiqueta}</span>
      {children}
      {ayuda && <span className="text-2xs text-gris-50">{ayuda}</span>}
    </label>
  )
}

export default function EditarFicha({
  ficha,
  clientes,
  personas,
  etapas,
  esOportunidad,
  puedeEditar,
  alCerrar,
}: {
  ficha: Ficha
  clientes: Cliente[]
  personas: { id: string; nombre: string }[]
  etapas: { valor: string; etiqueta: string }[]
  esOportunidad: boolean
  /* Sin permiso se abre igual, en solo lectura: esconder la ficha no
     explica nada, y "no podés editar esto" sí. */
  puedeEditar: boolean
  alCerrar: () => void
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [v, setV] = useState({
    nombre: ficha.nombre,
    organizacion_id: ficha.organizacion_id,
    clienteNuevo: '',
    responsable_id: ficha.responsable_id ?? '',
    fecha_inicio: ficha.fecha_inicio ?? '',
    fecha_comprometida: ficha.fecha_comprometida ?? '',
    monto_neto: ficha.monto_neto?.toString() ?? '',
    descripcion: ficha.descripcion ?? '',
    etapa: ficha.etapa ?? '',
  })
  const panel = useRef<HTMLDivElement>(null)

  /* Escape cierra: es lo que hace todo panel que se abre encima de algo,
     y no tenerlo obliga a ir a buscar la cruz con el mouse. */
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar()
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [alCerrar])

  const cambio = (k: keyof typeof v) => (x: string) => setV((p) => ({ ...p, [k]: x }))

  function guardar() {
    setError(null)
    // Solo lo que cambió: mandar todo pisaría lo que otro editó mientras.
    const campos: CamposProyecto = {}
    if (v.nombre !== ficha.nombre) campos.nombre = v.nombre.trim()
    if (v.organizacion_id !== ficha.organizacion_id && v.organizacion_id !== 'nuevo')
      campos.organizacion_id = v.organizacion_id
    if (v.responsable_id !== (ficha.responsable_id ?? ''))
      campos.responsable_id = v.responsable_id || null
    if (v.fecha_inicio !== (ficha.fecha_inicio ?? ''))
      campos.fecha_inicio = v.fecha_inicio || null
    if (v.fecha_comprometida !== (ficha.fecha_comprometida ?? ''))
      campos.fecha_comprometida = v.fecha_comprometida || null
    if (v.descripcion !== (ficha.descripcion ?? ''))
      campos.descripcion = v.descripcion || null
    if (v.etapa !== (ficha.etapa ?? '') && v.etapa) campos.etapa = v.etapa
    if (v.monto_neto !== (ficha.monto_neto?.toString() ?? ''))
      campos.monto_neto = v.monto_neto === '' ? null : Number(v.monto_neto)

    if (campos.monto_neto !== undefined && campos.monto_neto !== null && isNaN(campos.monto_neto))
      return setError('El monto tiene que ser un número.')

    empezar(async () => {
      const r = await editarProyecto(ficha.id, campos)
      if (r.ok) alCerrar()
      else setError(r.error)
    })
  }

  return (
    <div className="fixed inset-0 z-(--z-modal) flex justify-end">
      {/* El fondo se oscurece apenas: lo de atrás tiene que seguir
          leyéndose, porque es el contexto de lo que se está editando. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={alCerrar}
        className="absolute inset-0 bg-tinta/15 backdrop-blur-[2px]"
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={`Editar ${ficha.nombre}`}
        className="entra-de-costado relative flex h-full w-full max-w-md flex-col
                   border-l border-linea bg-superficie shadow-[var(--sombra-flotante)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-linea px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="rotulo">{esOportunidad ? 'Oportunidad' : 'Proyecto'}</span>
            <h2 className="truncate text-base font-bold tracking-tight text-tinta">
              {ficha.nombre}
            </h2>
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
          {!puedeEditar && (
            <p className="rounded-md border border-linea bg-panel px-3 py-2 text-2xs text-gris">
              Estás viendo esta ficha en solo lectura. Para editarla tenés que ser el responsable
              o estar asignado.
            </p>
          )}

          <fieldset disabled={!puedeEditar || pendiente} className="flex flex-col gap-4">
            <Campo etiqueta="Nombre">
              <input
                value={v.nombre}
                onChange={(e) => cambio('nombre')(e.target.value)}
                className="campo w-full"
                autoFocus
              />
            </Campo>

            <div className="flex flex-col gap-1">
              <span className="rotulo">Cliente</span>
              <ElegirCliente
                clientes={clientes}
                elegido={v.organizacion_id}
                nombreNuevo={v.clienteNuevo}
                alElegir={cambio('organizacion_id')}
                alEscribirNuevo={cambio('clienteNuevo')}
              />
            </div>

            {esOportunidad && etapas.length > 0 && (
              <Campo etiqueta="Etapa">
                <select
                  value={v.etapa}
                  onChange={(e) => cambio('etapa')(e.target.value)}
                  className="campo w-full cursor-pointer"
                >
                  {etapas.map((e) => (
                    <option key={e.valor} value={e.valor}>
                      {e.etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
            )}

            <Campo etiqueta="Responsable">
              <select
                value={v.responsable_id}
                onChange={(e) => cambio('responsable_id')(e.target.value)}
                className="campo w-full cursor-pointer"
              >
                <option value="">sin responsable</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta={esOportunidad ? 'Desde' : 'Arranca'}>
                <input
                  type="date"
                  value={v.fecha_inicio}
                  onChange={(e) => cambio('fecha_inicio')(e.target.value)}
                  className="campo cifra w-full"
                />
              </Campo>
              <Campo etiqueta={esOportunidad ? 'Cierre estimado' : 'Entrega'}>
                <input
                  type="date"
                  value={v.fecha_comprometida}
                  onChange={(e) => cambio('fecha_comprometida')(e.target.value)}
                  className="campo cifra w-full"
                />
              </Campo>
            </div>

            <Campo
              etiqueta={esOportunidad ? 'Valor cotizado' : 'Monto'}
              ayuda="Cambiarlo necesita el permiso de montos."
            >
              <input
                value={v.monto_neto}
                inputMode="decimal"
                onChange={(e) => cambio('monto_neto')(e.target.value)}
                placeholder="sin cargar"
                className="campo cifra w-full"
              />
            </Campo>

            <Campo etiqueta="Notas">
              <textarea
                value={v.descripcion}
                onChange={(e) => cambio('descripcion')(e.target.value)}
                rows={4}
                placeholder="Lo que haya que recordar de este trabajo."
                className="campo w-full resize-y"
              />
            </Campo>
          </fieldset>
        </div>

        {puedeEditar && (
          <footer className="flex flex-col gap-2 border-t border-linea px-5 py-3">
            {error && (
              <p role="alert" className="text-2xs text-rojo">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={guardar}
                disabled={pendiente}
                className="boton boton-principal flex-1 justify-center"
              >
                {pendiente ? 'Guardando…' : 'Guardar'}
              </button>
              <button type="button" onClick={alCerrar} className="boton boton-sutil">
                Cancelar
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}

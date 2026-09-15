'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  anotarEnBitacora,
  borrarDeBitacora,
  cambiarVisibilidadBitacora,
  type EntradaBitacora,
} from '@/app/acciones'

/* ------------------------------------------------------------------
   Qué se entregó, y el resumen para contarlo.

   La razón de que esto exista es la pregunta de fin de mes: el cliente
   del abono quiere saber qué se hizo con su plata. Hoy eso se
   reconstruye de memoria y de los commits, y se reconstruye de menos:
   lo chico se olvida, y lo chico sumado es la mitad del mes.

   Por eso el formulario pide dos cosas y nada más. Lo que no se carga
   en veinte segundos no se carga, y una bitácora incompleta es peor que
   ninguna: da una sensación de registro que después no aguanta.

   El resumen se arma con lo que está marcado para el cliente y dentro
   del rango. No se manda solo desde acá —el sistema no tiene por dónde
   mandar mails— así que lo que hace es dejarlo listo: al portapapeles
   para pegarlo en WhatsApp, abierto en el programa de correo, o en una
   hoja para imprimir a PDF. Lo manda una persona, que además lo lee
   antes, que es exactamente lo que uno quiere que pase con algo que
   sale hacia afuera.
   ------------------------------------------------------------------ */

const TIPOS: [string, string, string][] = [
  ['mejora', 'Mejora', '✨'],
  ['bugfix', 'Arreglo', '🔧'],
  ['nueva_funcionalidad', 'Nuevo', '🚀'],
  ['soporte', 'Soporte', '💬'],
]

const NOMBRE = new Map(TIPOS.map(([v, t]) => [v, t]))
const EMOJI = new Map(TIPOS.map(([v, , e]) => [v, e]))

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function enCastellano(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} de ${MESES[m - 1]}`
}

export default function Bitacora({
  proyectoId,
  proyecto,
  cliente,
  entradas,
  hoy,
  puedeAnotar,
}: {
  proyectoId: string
  proyecto: string
  cliente: string
  entradas: EntradaBitacora[]
  hoy: string
  puedeAnotar: boolean
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [abierto, setAbierto] = useState(false)

  const [tipo, setTipo] = useState('mejora')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [visible, setVisible] = useState(true)

  /* El rango arranca en el mes corriente, que es cuando se pide el
     resumen el noventa por ciento de las veces. */
  const primeroDelMes = `${hoy.slice(0, 7)}-01`
  const [desde, setDesde] = useState(primeroDelMes)
  const [hasta, setHasta] = useState(hoy)
  const [resumiendo, setResumiendo] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const delRango = useMemo(
    () =>
      entradas
        .filter((e) => e.visibilidad_cliente && e.fecha_entrega >= desde && e.fecha_entrega <= hasta)
        .slice()
        .sort((a, b) => a.fecha_entrega.localeCompare(b.fecha_entrega)),
    [entradas, desde, hasta],
  )

  const texto = useMemo(() => {
    if (delRango.length === 0) return ''
    const cabeza = `*${proyecto}* · ${cliente}\nLo que hicimos entre el ${enCastellano(desde)} y el ${enCastellano(hasta)}:\n`
    const cuerpo = delRango
      .map((e) => {
        const d = e.descripcion ? `\n   ${e.descripcion}` : ''
        return `${EMOJI.get(e.tipo) ?? '•'} ${e.titulo}${d}`
      })
      .join('\n')
    return `${cabeza}\n${cuerpo}\n\n${delRango.length} ${delRango.length === 1 ? 'entrega' : 'entregas'} en el período.`
  }, [delRango, proyecto, cliente, desde, hasta])

  function anotar() {
    setError(null)
    empezar(async () => {
      const r = await anotarEnBitacora(proyectoId, { tipo, titulo, descripcion, fecha, visible })
      if (!r.ok) return setError(r.error)
      setTitulo('')
      setDescripcion('')
      setVisible(true)
      setAbierto(false)
    })
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 2200)
    } catch {
      setError('El navegador no dejó copiar. Seleccioná el texto de abajo y copialo a mano.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-md font-bold tracking-tight">Bitácora</h2>
          <p className="max-w-[62ch] text-sm text-gris">
            Qué se entregó y cuándo. Es de donde sale el resumen que ve el cliente a fin de mes.
          </p>
        </div>

        <span className="flex gap-2">
          {puedeAnotar && !abierto && (
            <button type="button" onClick={() => setAbierto(true)} className="boton boton-principal">
              Anotar algo
            </button>
          )}
          {entradas.length > 0 && (
            <button
              type="button"
              onClick={() => setResumiendo((v) => !v)}
              className="boton boton-secundario"
            >
              {resumiendo ? 'Cerrar resumen' : 'Generar resumen'}
            </button>
          )}
        </span>
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      {/* ── anotar ─────────────────────────────────────────── */}
      {abierto && (
        <div className="surge tarjeta flex flex-col gap-3 p-4">
          <div className="flex flex-wrap gap-1">
            {TIPOS.map(([v, t, e]) => (
              <button
                key={v}
                type="button"
                onClick={() => setTipo(v)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs
                            transition-colors duration-150 ${
                              tipo === v
                                ? 'bg-tinta text-white'
                                : 'text-gris hover:bg-panel hover:text-tinta'
                            }`}
              >
                <span aria-hidden>{e}</span>
                {t}
              </button>
            ))}
          </div>

          <label className="flex flex-col gap-0.5">
            <span className="rotulo">Qué se hizo</span>
            <input
              value={titulo}
              autoFocus
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Buscador por código de barras en el catálogo"
              className="campo w-full"
            />
          </label>

          <label className="flex flex-col gap-0.5">
            <span className="rotulo">Detalle, si hace falta</span>
            <textarea
              value={descripcion}
              rows={2}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Opcional. Va debajo del título en el resumen del cliente."
              className="campo w-full resize-y"
            />
          </label>

          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Entregado el</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="campo cifra w-40"
              />
            </label>

            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
                className="size-4 accent-[var(--color-azul-hondo)]"
              />
              <span className="text-2xs text-gris">
                Entra en el resumen del cliente
              </span>
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={anotar}
              disabled={pendiente || !titulo.trim()}
              className="boton boton-principal"
            >
              {pendiente ? 'Anotando…' : 'Anotar'}
            </button>
            <button type="button" onClick={() => setAbierto(false)} className="boton boton-sutil">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ── el resumen ─────────────────────────────────────── */}
      {resumiendo && (
        <div className="surge tarjeta flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Desde</span>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="campo cifra w-40"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Hasta</span>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="campo cifra w-40"
              />
            </label>
            <button
              type="button"
              onClick={() => {
                setDesde(primeroDelMes)
                setHasta(hoy)
              }}
              className="boton boton-sutil boton-chico mb-1"
            >
              Este mes
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date(`${hoy}T00:00:00`)
                d.setDate(d.getDate() - 7)
                setDesde(d.toISOString().slice(0, 10))
                setHasta(hoy)
              }}
              className="boton boton-sutil boton-chico mb-1"
            >
              Última semana
            </button>
          </div>

          {delRango.length === 0 ? (
            <p className="rounded-md border border-amarillo bg-amarillo-aire px-3 py-2 text-2xs text-tinta">
              No hay entregas marcadas para el cliente en ese período. Revisá las fechas, o si
              alguna quedó sin marcar como visible.
            </p>
          ) : (
            <>
              {/* Se muestra el texto exacto que se va a mandar. Un botón
                  que copia algo que no se vio es un botón que da miedo
                  apretar, sobre todo si lo que copia va a un cliente. */}
              <pre className="riel max-h-64 overflow-auto whitespace-pre-wrap rounded-md border
                              border-linea bg-panel px-3 py-2.5 text-2xs leading-relaxed text-tinta">
{texto}
              </pre>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={copiar} className="boton boton-principal boton-chico">
                  {copiado ? 'Copiado ✓' : 'Copiar para WhatsApp'}
                </button>

                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    `${proyecto} · lo que hicimos`,
                  )}&body=${encodeURIComponent(texto.replace(/\*/g, ''))}`}
                  className="boton boton-secundario boton-chico"
                >
                  Abrir en el correo
                </a>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="boton boton-secundario boton-chico"
                >
                  Imprimir o guardar en PDF
                </button>
              </div>

              <p className="text-2xs text-gris-50">
                Ninguno de los tres manda nada solo: dejan el mensaje listo y lo mandás vos. Lo que
                sale hacia un cliente conviene leerlo antes.
              </p>
            </>
          )}
        </div>
      )}

      {/* ── la línea de tiempo ─────────────────────────────── */}
      {entradas.length === 0 ? (
        <p className="rounded-lg border border-linea bg-panel px-3.5 py-6 text-center text-sm text-gris">
          Todavía no hay nada anotado. Cada mejora, arreglo o función nueva que se anote acá es una
          menos que hay que recordar a fin de mes.
        </p>
      ) : (
        <ul className="flex flex-col">
          {entradas.map((e, i) => (
            <li key={e.id} className="flex gap-3">
              {/* El hilo del tiempo. El último no lo lleva: una línea que
                  sigue después del último punto promete algo que no hay. */}
              <span className="flex flex-col items-center pt-1.5">
                <span className="text-sm leading-none" aria-hidden>
                  {EMOJI.get(e.tipo) ?? '•'}
                </span>
                {i < entradas.length - 1 && <span className="w-px flex-1 bg-linea" />}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-tinta">{e.titulo}</span>
                  <span className="rotulo">{NOMBRE.get(e.tipo) ?? e.tipo}</span>
                  {!e.visibilidad_cliente && (
                    <span className="text-2xs text-gris-50">· no va en el resumen</span>
                  )}
                </span>

                {e.descripcion && (
                  <span className="text-2xs leading-snug text-gris">{e.descripcion}</span>
                )}

                <span className="flex flex-wrap items-center gap-x-2 text-2xs text-gris-50">
                  <span className="cifra">{enCastellano(e.fecha_entrega)}</span>
                  {e.autor && <span>· {e.autor.split(' ')[0]}</span>}

                  {puedeAnotar && (
                    <>
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() =>
                          empezar(async () => {
                            const r = await cambiarVisibilidadBitacora(e.id, !e.visibilidad_cliente)
                            if (!r.ok) setError(r.error)
                          })
                        }
                        className="underline underline-offset-2 transition-colors duration-150
                                   hover:text-tinta"
                      >
                        {e.visibilidad_cliente ? 'ocultar del resumen' : 'mostrar en el resumen'}
                      </button>
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() =>
                          empezar(async () => {
                            const r = await borrarDeBitacora(e.id)
                            if (!r.ok) setError(r.error)
                          })
                        }
                        className="underline underline-offset-2 transition-colors duration-150
                                   hover:text-rojo"
                      >
                        borrar
                      </button>
                    </>
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

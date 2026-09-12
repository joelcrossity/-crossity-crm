'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  borrarDocumento,
  cambiarCarpeta,
  marcarEnviado,
  sumarDocumento,
} from '@/app/acciones'
import { fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   Documentación.

   Guarda el link, no una copia. Los archivos viven en Drive y se siguen
   editando ahí; una copia acá se desactualiza el primer día y a partir
   de entonces nadie sabe cuál es la buena.

   Lo que el sistema aporta es lo que Drive no sabe: qué se le mandó al
   cliente, cuándo y en qué versión. Eso hoy vive en la cabeza de quien
   lo mandó, y por eso "¿le pasamos ya el contrato?" se pregunta cuatro
   veces por semana.
   ------------------------------------------------------------------ */

export type Documento = {
  id: string
  titulo: string
  url: string
  clase: string
  version: string | null
  enviado_at: string | null
  enviado_por: string | null
}

const CLASES: [string, string][] = [
  ['propuesta', 'Propuesta'],
  ['contrato', 'Contrato'],
  ['plan_de_trabajo', 'Plan de trabajo'],
  ['entregable', 'Entregable'],
  ['factura', 'Factura'],
  ['carpeta', 'Carpeta'],
  ['otro', 'Otro'],
]

const NOMBRE = new Map(CLASES)

const campo =
  'rounded-md border border-linea bg-superficie px-2.5 py-1.5 text-sm text-tinta ' +
  'transition-colors duration-150 placeholder:text-gris-50 ' +
  'hover:border-linea-fuerte focus:border-azul'

const rotulo = 'text-2xs font-medium uppercase tracking-wider text-gris-50'

export default function Documentos({
  documentos,
  proyectoId,
  organizacionId,
  carpeta,
  duenoTabla,
  duenoId,
}: {
  documentos: Documento[]
  proyectoId?: string
  organizacionId?: string
  carpeta: string | null
  duenoTabla: 'proyectos' | 'organizaciones'
  duenoId: string
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [link, setLink] = useState(carpeta ?? '')

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, alTerminar?: () => void) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else {
        alTerminar?.()
        router.refresh()
      }
    })
  }

  const sinEnviar = documentos.filter(
    (d) => !d.enviado_at && ['propuesta', 'contrato', 'plan_de_trabajo'].includes(d.clase),
  ).length

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-md font-bold tracking-tight">Documentación</h2>
          <p className="max-w-[65ch] text-sm text-gris">
            Se guarda el link, no una copia: el archivo sigue viviendo en Drive y se edita ahí. Lo
            que se anota acá es qué se mandó y cuándo.
            {sinEnviar > 0 && (
              <span className="font-medium text-amarillo">
                {' '}
                {sinEnviar} armado{sinEnviar > 1 ? 's' : ''} y sin mandar.
              </span>
            )}
          </p>
        </div>

        {!abierto && (
          <button
            type="button"
            onClick={() => setAbierto(true)}
            className="boton boton-secundario shrink-0"
          >
            Sumar documento
          </button>
        )}
      </div>

      {/* La carpeta canónica: "andá acá y está todo", que es lo que uno
          quiere el noventa por ciento de las veces. */}
      <label className="flex flex-col gap-0.5">
        <span className={rotulo}>Carpeta de Drive</span>
        <span className="flex flex-wrap items-center gap-2">
          <input
            value={link}
            placeholder="https://drive.google.com/…"
            disabled={pendiente}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() =>
              link !== (carpeta ?? '') && correr(() => cambiarCarpeta(duenoTabla, duenoId, link))
            }
            className={`${campo} min-w-0 flex-1`}
          />
          {carpeta && (
            <a
              href={carpeta}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md bg-azul-hondo px-3 py-1.5 text-sm font-medium text-white
                         transition-colors duration-150 hover:bg-azul"
            >
              Abrir carpeta
            </a>
          )}
        </span>
      </label>

      {abierto && (
        <form
          action={(fd) => correr(() => sumarDocumento(fd), () => setAbierto(false))}
          className="surge flex flex-wrap items-end gap-2 rounded-lg border border-azul bg-azul-aire p-3"
        >
          <input type="hidden" name="proyecto_id" value={proyectoId ?? ''} />
          <input type="hidden" name="organizacion_id" value={organizacionId ?? ''} />

          <select name="clase" defaultValue="propuesta" className={`${campo} w-40`} aria-label="Qué es">
            {CLASES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
          <input name="titulo" required placeholder="Cómo se llama" className={`${campo} w-56`} autoFocus />
          <input name="version" placeholder="v1, final…" className={`${campo} w-24`} />
          <input
            name="url"
            required
            type="url"
            placeholder="https://…"
            className={`${campo} min-w-56 flex-1`}
          />
          <label className="flex flex-col gap-0.5">
            <span className={rotulo}>Se lo mandamos el</span>
            <input name="enviado_at" type="date" className={`${campo} cifra w-40`} />
          </label>

          <button
            type="submit"
            disabled={pendiente}
            className="boton boton-principal"
          >
            {pendiente ? 'Guardando…' : 'Guardar'}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="boton boton-sutil"
          >
            Cancelar
          </button>
          <p className="w-full text-2xs text-gris-50">
            Dejá vacía la fecha si todavía no se lo mandaste. Vas a poder marcarlo después.
          </p>
        </form>
      )}

      {error && <p className="text-sm text-rojo">{error}</p>}

      {documentos.length === 0 ? (
        <p className="tarjeta px-3.5 py-3 text-sm text-gris">
          Todavía no hay nada cargado. Empezá por la propuesta y el contrato: son los que después
          nadie encuentra.
        </p>
      ) : (
        <ul className="escalona flex flex-col gap-1.5">
          {documentos.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-linea
                         bg-superficie px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className={rotulo}>{NOMBRE.get(d.clase) ?? d.clase}</span>
                  {d.version && <span className="cifra text-2xs text-gris-50">{d.version}</span>}
                </span>
                <a
                  href={d.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-base font-medium text-tinta transition-colors
                             duration-150 hover:text-azul-hondo"
                >
                  {d.titulo}
                </a>
                <span className="block truncate text-2xs text-gris-50">
                  {d.enviado_at ? (
                    <>
                      Se lo mandamos el {fechaCorta(d.enviado_at)}
                      {d.enviado_por && ` · ${d.enviado_por}`}
                    </>
                  ) : (
                    <span className="text-amarillo">Todavía no se lo mandamos</span>
                  )}
                </span>
              </span>

              {!d.enviado_at && (
                <input
                  type="date"
                  aria-label={`Cuándo se mandó ${d.titulo}`}
                  disabled={pendiente}
                  onChange={(e) => correr(() => marcarEnviado(d.id, e.target.value))}
                  className={`${campo} cifra w-36 shrink-0`}
                />
              )}

              <button
                type="button"
                aria-label={`Borrar ${d.titulo}`}
                disabled={pendiente}
                onClick={() => correr(() => borrarDocumento(d.id))}
                className="shrink-0 text-sm leading-none text-gris-50 transition-colors duration-150 hover:text-rojo"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

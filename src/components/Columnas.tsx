'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cambiarZona, moverColumna, renombrarColumna } from '@/app/acciones'
import { Seccion } from '@/components/ui'
import type { Columna } from '@/components/TableroEstados'

/* ------------------------------------------------------------------
   Las columnas del tablero de Proyectos.

   Lo que se cambia acá se ve en el tablero, porque es la misma tabla:
   el tablero no tiene una lista propia. Antes sí la tenía, y por eso
   renombrar algo acá no cambiaba nada allá.

   No se crean ni se borran. Cada columna es un recorte de un estado que
   la base define —un color, y a veces un motivo dentro de ese color— y
   un color nuevo rompería reglas que existen por buenas razones: gris
   exige motivo, verde exige detalle, naranja cierra.
   ------------------------------------------------------------------ */

const PUNTO: Record<string, string> = {
  verde: 'bg-verde',
  amarillo: 'bg-amarillo',
  gris: 'bg-gris-25',
  naranja: 'bg-naranja',
  rojo: 'bg-rojo',
}

const campo = 'campo'

/* Afuera del componente: definida adentro, React la trata como un tipo
 nuevo en cada render y desmonta las filas, perdiendo lo que se estaba
 escribiendo en un campo. */
function Zona({
zona,
titulo,
ayuda,
columnas,
esDireccion,
pendiente,
correr,
}: {
zona: string
titulo: string
ayuda: string
columnas: Columna[]
esDireccion: boolean
pendiente: boolean
correr: (fn: () => Promise<{ ok: boolean; error?: string }>) => void
}) {
const suyas = columnas.filter((c) => c.zona === zona)
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-col gap-0.5">
        <h3 className="text-sm font-bold tracking-tight text-tinta">{titulo}</h3>
        <span className="text-2xs text-gris-50">{ayuda}</span>
      </span>

      {suyas.length === 0 ? (
        <p className="tarjeta px-3.5 py-3 text-2xs text-gris-50">Ninguna.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {suyas.map((c, i) => (
            <li
              key={c.clave}
              className="tarjeta flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
            >
              {esDireccion && (
                <span className="flex shrink-0 flex-col gap-px">
                  <Flecha
                    hacia="arriba"
                    apagada={i === 0 || pendiente}
                    alClic={() => correr(() => moverColumna(c.clave, -1))}
                  />
                  <Flecha
                    hacia="abajo"
                    apagada={i === suyas.length - 1 || pendiente}
                    alClic={() => correr(() => moverColumna(c.clave, 1))}
                  />
                </span>
              )}

              <span className={`size-2.5 shrink-0 rounded-full ${PUNTO[c.color]}`} aria-hidden />

              <span className="min-w-0 flex-1">
                {esDireccion ? (
                  <Editable
                    clave={c.clave}
                    etiqueta={c.etiqueta}
                    ayuda={c.ayuda}
                    pendiente={pendiente}
                    alGuardar={(t, a) => correr(() => renombrarColumna(c.clave, t, a))}
                  />
                ) : (
                  <span>
                    <span className="block text-base font-medium text-tinta">{c.etiqueta}</span>
                    <span className="block text-2xs text-gris-50">{c.ayuda}</span>
                  </span>
                )}
              </span>

              {esDireccion && (
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() =>
                    correr(() => cambiarZona(c.clave, zona === 'arriba' ? 'abajo' : 'arriba'))
                  }
                  className="boton boton-secundario boton-chico shrink-0"
                >
                  {zona === 'arriba' ? 'Bajarla al pie' : 'Subirla al tablero'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Columnas({
  columnas,
  esDireccion,
}: {
  columnas: Columna[]
  esDireccion: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo guardar.')
      else router.refresh()
    })
  }



  return (
    <Seccion
      titulo="Columnas del tablero"
      ayuda="Lo que se cambia acá se ve en el tablero de Proyectos, porque es la misma tabla. Las de arriba son columnas; las de abajo viven plegadas al pie para no molestar todos los días."
    >
      {error && <p className="text-sm font-medium text-rojo">{error}</p>}

      <div className="flex flex-col gap-6">
        <Zona
          zona="arriba"
          titulo="Arriba, como columnas"
          ayuda="lo que se mira todos los días"
          columnas={columnas}
          esDireccion={esDireccion}
          pendiente={pendiente}
          correr={correr}
        />
        <Zona
          zona="abajo"
          titulo="Abajo, plegadas"
          ayuda="lo que ya cerró y solo se consulta"
          columnas={columnas}
          esDireccion={esDireccion}
          pendiente={pendiente}
          correr={correr}
        />
      </div>

      <p className="text-2xs text-gris-50">
        No se crean ni se borran: cada una es un recorte de un estado que la base define. Por
        arrancar y Frenado son las dos grises, y se distinguen por el motivo.
      </p>
    </Seccion>
  )
}

function Editable({
  etiqueta,
  ayuda,
  pendiente,
  alGuardar,
}: {
  clave: string
  etiqueta: string
  ayuda: string
  pendiente: boolean
  alGuardar: (texto: string, ayuda: string) => void
}) {
  const [t, setT] = useState(etiqueta)
  const [a, setA] = useState(ayuda)

  return (
    <span className="flex flex-wrap items-center gap-2">
      <input
        value={t}
        disabled={pendiente}
        onChange={(e) => setT(e.target.value)}
        onBlur={() => (t !== etiqueta || a !== ayuda) && alGuardar(t, a)}
        className={`${campo} w-40 font-medium`}
        aria-label="Nombre de la columna"
      />
      <input
        value={a}
        disabled={pendiente}
        onChange={(e) => setA(e.target.value)}
        onBlur={() => (t !== etiqueta || a !== ayuda) && alGuardar(t, a)}
        className={`${campo} min-w-44 flex-1 text-2xs`}
        aria-label="Qué significa"
      />
    </span>
  )
}

function Flecha({
  hacia,
  apagada,
  alClic,
}: {
  hacia: 'arriba' | 'abajo'
  apagada: boolean
  alClic: () => void
}) {
  return (
    <button
      type="button"
      disabled={apagada}
      onClick={alClic}
      aria-label={hacia === 'arriba' ? 'Subir' : 'Bajar'}
      className="grid size-5 place-items-center rounded text-gris-50 transition-colors duration-150
                 hover:text-azul-hondo disabled:opacity-25"
    >
      <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
        <path
          d={hacia === 'arriba' ? 'M3 7.5 6 4.5l3 3' : 'M3 4.5 6 7.5l3-3'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}

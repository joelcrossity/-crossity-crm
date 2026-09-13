'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'

/* ------------------------------------------------------------------
   Guardar lo que se está escribiendo, por las dudas.

   Perder una cotización de seis etapas por cerrar una pestaña pasa una
   vez y no se olvida. Esto la guarda sola mientras se escribe.

   Va en el navegador y no en la base a propósito. Un borrador es
   privado y a medio hacer: mandarlo al servidor lo haría visible para
   el resto del equipo antes de que su autor decida que está listo, y
   obligaría a decidir qué hacer con los borradores de alguien que se
   fue. Acá vive en la máquina de quien lo escribió y se borra solo al
   guardar.

   El estado ("guardando", "guardado") vive en un store afuera de React
   y no en useState. React no deja escribir estado desde un efecto —y
   tiene razón: encadena renders— así que el efecto avisa al store y los
   componentes se suscriben. Es el mismo patrón que ya usan el dictado y
   el buscador.

   El retardo de medio segundo no es por rendimiento —escribir en
   localStorage es instantáneo— sino para que el cartel no titile con
   cada tecla. El aviso tiene que tranquilizar, no distraer.
   ------------------------------------------------------------------ */

const PREFIJO = 'borrador:'

export type EstadoBorrador = 'limpio' | 'guardando' | 'guardado'

const estados = new Map<string, EstadoBorrador>()
const oyentes = new Map<string, Set<() => void>>()
/* Una marca por clave que cambia cuando el contenido guardado cambia.
   Sin esto habría que devolver el objeto parseado desde el snapshot, y
   un objeto nuevo en cada lectura haría que useSyncExternalStore
   redibuje para siempre. */
const versiones = new Map<string, number>()
/* Las claves cuyo borrador ya se ofreció y se resolvió —restaurado o
   descartado—. Va en el store y no en un ref porque se lee durante el
   render, y React no deja leer refs ahí: un ref puede cambiar sin
   avisar y el render quedaría mostrando algo viejo. */
const resueltos = new Set<string>()

function avisar(clave: string) {
  oyentes.get(clave)?.forEach((f) => f())
}

function fijarEstado(clave: string, e: EstadoBorrador) {
  if (estados.get(clave) === e) return
  estados.set(clave, e)
  avisar(clave)
}

function suscribir(clave: string) {
  return (f: () => void) => {
    if (!oyentes.has(clave)) oyentes.set(clave, new Set())
    oyentes.get(clave)!.add(f)
    return () => {
      oyentes.get(clave)?.delete(f)
    }
  }
}

function leerCrudo(clave: string): string | null {
  try {
    return window.localStorage.getItem(PREFIJO + clave)
  } catch {
    /* Puede fallar por modo privado, cuota llena o permisos. En todos
       los casos la respuesta es la misma: no hay borrador. Uno que no
       se puede leer no vale romper el formulario. */
    return null
  }
}

export function useBorrador<T extends object>(
  clave: string,
  valor: T,
  /* Falso mientras no haya nada que guardar. Sin esto, abrir un
     formulario y cerrarlo sin tocar nada dejaría un borrador vacío que
     después se ofrece restaurar. */
  vale = true,
) {
  const estado = useSyncExternalStore(
    suscribir(clave),
    () => estados.get(clave) ?? 'limpio',
    () => 'limpio' as EstadoBorrador,
  )

  /* En el servidor no hay borrador: devolver null en las dos lecturas
     evita que el HTML que llega y el que React dibuja discrepen. */
  const version = useSyncExternalStore(
    suscribir(clave),
    () => versiones.get(clave) ?? 0,
    () => 0,
  )

  const primera = useRef(true)

  const hay = (() => {
    // version entra en la cuenta para que esto se recalcule al avisar.
    if (version < 0 || resueltos.has(clave)) return null
    if (typeof window === 'undefined') return null
    const crudo = leerCrudo(clave)
    if (!crudo) return null
    try {
      return JSON.parse(crudo) as T
    } catch {
      return null
    }
  })()

  useEffect(() => {
    /* El primer render no guarda: son los valores iniciales, no algo
       que la persona escribió. Sin esto, abrir el formulario pisaría el
       borrador que había con los campos vacíos. */
    if (primera.current) {
      primera.current = false
      return
    }
    if (!vale) return

    fijarEstado(clave, 'guardando')
    const t = setTimeout(() => {
      try {
        window.localStorage.setItem(PREFIJO + clave, JSON.stringify(valor))
        fijarEstado(clave, 'guardado')
      } catch {
        // Sin lugar o sin permiso: se sigue trabajando igual, sin red.
        fijarEstado(clave, 'limpio')
      }
    }, 500)

    return () => clearTimeout(t)
  }, [clave, valor, vale])

  const olvidar = useCallback(() => {
    try {
      window.localStorage.removeItem(PREFIJO + clave)
    } catch {
      // Si no se puede borrar, tampoco se pudo haber guardado.
    }
    resueltos.add(clave)
    versiones.set(clave, (versiones.get(clave) ?? 0) + 1)
    fijarEstado(clave, 'limpio')
    avisar(clave)
  }, [clave])

  /* Devuelve lo guardado y deja de ofrecerlo: quien lo llama lo aplica
     a su estado, y volver a ofrecerlo sería ofrecer lo que ya está en
     pantalla. No borra el guardado, porque si la persona sigue
     escribiendo se va a pisar solo. */
  const restaurar = useCallback(() => {
    const previo = hay
    resueltos.add(clave)
    versiones.set(clave, (versiones.get(clave) ?? 0) + 1)
    avisar(clave)
    return previo
  }, [clave, hay])

  return { hay, restaurar, olvidar, estado }
}

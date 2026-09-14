'use client'

import { useEffect, useState, useTransition } from 'react'
import { guardarPropuesta, leerPropuesta } from '@/app/acciones'
import type { EtapaPropuesta } from '@/app/acciones'
import Cotizador from '@/components/Cotizador'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   Las etapas, dentro del proyecto y no sólo en el pipeline.

   Hasta ahora esto vivía únicamente en el lápiz de la oportunidad: se
   cotizaba por etapas, se ganaba, y desde ese momento la propuesta
   quedaba congelada. Pero un proyecto sigue creciendo después de
   ganarse —el cliente pide una etapa más, se corre una entrega, se
   ajusta un número— y no tenerlo acá obligaba a volver al pipeline por
   algo que ya no es pipeline.

   Lo que está en ejecución no se toca. La base protege eso sola: al
   guardar sólo borra y reordena entregas inactivas, así que una cuota
   con plata ya repartida no se puede perder desde acá aunque se
   intente. Acá arriba se dice, para que no haya que descubrirlo.

   Una etapa nueva nace apagada y sin fechas. Eso es lo que la hace
   servir: se puede cotizar lo que viene sin que aparezca en el
   calendario de nadie ni entre en la previsión de cobros, y se activa
   el día que el cliente dice que sí.
   ------------------------------------------------------------------ */

export default function EtapasDelProyecto({
  proyectoId,
  moneda,
  cotizacion,
  editable,
}: {
  proyectoId: string
  moneda: string
  cotizacion: number | null
  /* Cambiar montos es su propio permiso: acá se reparte plata. */
  editable: boolean
}) {
  const [pendiente, empezar] = useTransition()
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [etapas, setEtapas] = useState<EtapaPropuesta[]>([])

  useEffect(() => {
    let vivo = true
    leerPropuesta(proyectoId).then((r) => {
      if (!vivo) return
      if (r.ok) setEtapas(r.etapas)
      else setError(r.error)
      setCargando(false)
    })
    return () => {
      vivo = false
    }
  }, [proyectoId])

  const activas = etapas.filter((e) => e.cuotas.some((q) => q.activa)).length

  function guardar() {
    setError(null)
    setAviso(null)
    empezar(async () => {
      const r = await guardarPropuesta(
        proyectoId,
        etapas.map((e) => ({
          ...e,
          componentes: e.componentes.map((c) => ({ ...c, moneda })),
          cuotas: e.cuotas.map((q) => ({ ...q, moneda })),
        })),
      )
      if (!r.ok) return setError(r.error)
      setAviso('Guardado.')
    })
  }

  return (
    <Seccion
      titulo="Etapas y cotización"
      cuantos={etapas.length}
      ayuda="Cómo está partido el trabajo y cuánto vale cada parte. Lo que ya arrancó no se puede tocar desde acá."
    >
      {cargando ? (
        <p className="px-3 py-6 text-center text-2xs text-gris-50">Cargando la cotización…</p>
      ) : (
        <>
          {activas > 0 && (
            <p className="text-2xs text-gris-50">
              {activas === 1 ? 'Hay una etapa' : `Hay ${activas} etapas`} en ejecución. Sus entregas
              ya tienen plata repartida y no se borran desde acá: sumá una etapa nueva para lo que
              viene.
            </p>
          )}

          <Cotizador
            etapas={etapas}
            alCambiar={editable ? setEtapas : () => {}}
            moneda={moneda}
            cotizacion={cotizacion}
          />

          {error && (
            <p role="alert" className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-2xs text-rojo">
              {error}
            </p>
          )}

          {editable ? (
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={guardar}
                disabled={pendiente}
                className="boton boton-principal boton-chico w-fit"
              >
                {pendiente ? 'Guardando…' : 'Guardar la cotización'}
              </button>
              {aviso && <span className="text-2xs text-verde">{aviso}</span>}
            </span>
          ) : (
            <p className="text-2xs text-gris-50">
              Cambiar montos es un permiso aparte. Se habilita en Sistema → Usuarios y roles.
            </p>
          )}
        </>
      )}
    </Seccion>
  )
}

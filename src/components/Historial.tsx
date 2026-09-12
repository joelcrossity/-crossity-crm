'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { archivarLoCerrado, desarchivarProyecto } from '@/app/acciones'
import Filtro, { type Recorte } from '@/components/Filtro'
import { BarraSolapas, Aviso } from '@/components/ui'
import { plata, fechaCorta } from '@/lib/estados'

/* ------------------------------------------------------------------
   El historial.

   Se separa en dos pestañas porque son dos preguntas distintas. De un
   proyecto viejo uno quiere saber cuánto se cobró y quién lo hizo; de
   una oportunidad perdida, en qué etapa murió y por qué. Mezclarlos
   obligaría a que la tabla tenga columnas que sirven para la mitad de
   las filas.

   Lo que se ve acá lo decide la base, no esta pantalla: quien solo ve
   sus proyectos, ve solo los suyos archivados.
   ------------------------------------------------------------------ */

export type Archivado = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  cliente_codigo: string
  tipo: string
  etapa: string | null
  color: string
  motivo_gris: string | null
  motivo_rojo: string | null
  monto_neto: number | null
  moneda: string
  archivado_at: string
  archivado_por: string | null
  responsable: string | null
  servicio: string | null
  era_oportunidad: boolean
  cobrado: number
}

const CIERRE: Record<string, { texto: string; tono: string }> = {
  naranja: { texto: 'Terminado', tono: 'text-naranja' },
  rojo: { texto: 'Perdido', tono: 'text-rojo' },
  gris: { texto: 'Sin respuesta', tono: 'text-gris-50' },
  verde: { texto: 'Estaba en vivo', tono: 'text-verde' },
  amarillo: { texto: 'Estaba abierta', tono: 'text-amarillo' },
}

const MOTIVO: Record<string, string> = {
  entregado: 'se entregó',
  perdido: 'lo perdimos',
  descartado: 'lo descartamos',
  no_se_dio: 'no se dio',
  dormido: 'se durmió',
  pausado_cliente: 'lo pausó el cliente',
  esperando_anticipo: 'nunca entró el anticipo',
}

export default function Historial({
  filas,
  candidatos,
  puedeBarrer,
}: {
  filas: Archivado[]
  candidatos: number
  puedeBarrer: boolean
}) {
  const router = useRouter()
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [solapa, setSolapa] = useState<'proyectos' | 'oportunidades'>('proyectos')

  const proyectos = filas.filter((f) => !f.era_oportunidad)
  const oportunidades = filas.filter((f) => f.era_oportunidad)
  const visibles = solapa === 'proyectos' ? proyectos : oportunidades

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo.')
      else router.refresh()
    })
  }

  const recortes: Recorte<Archivado>[] = [
    {
      nombre: 'cierre',
      vacio: 'Cómo cerró',
      opciones: [
        { valor: 'naranja', texto: 'Terminado' },
        { valor: 'rojo', texto: 'Perdido' },
        { valor: 'gris', texto: 'Sin respuesta' },
      ],
      aplica: (f, v) => f.color === v,
    },
    {
      nombre: 'cuando',
      vacio: 'De cuándo',
      opciones: [
        { valor: '90', texto: 'Últimos 3 meses' },
        { valor: '365', texto: 'Último año' },
        { valor: 'viejo', texto: 'Más de un año' },
      ],
      aplica: (f, v) => {
        const dias = (Date.now() - new Date(f.archivado_at).getTime()) / 86400000
        return v === 'viejo' ? dias > 365 : dias <= Number(v)
      },
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {candidatos > 0 && puedeBarrer && (
        <Aviso
          tono="dato"
          accion={
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => archivarLoCerrado())}
              className="boton boton-principal boton-chico shrink-0"
            >
              {pendiente ? 'Archivando…' : `Archivar los ${candidatos}`}
            </button>
          }
        >
          Hay <span className="font-medium">{candidatos}</span> cerrados hace más de un mes que
          siguen en las listas del día. Sacarlos no borra nada.
        </Aviso>
      )}

      {error && (
        <Aviso tono="mal">{error}</Aviso>
      )}

      <BarraSolapas
        solapas={[
          { clave: 'proyectos' as const, texto: 'Proyectos', señal: proyectos.length },
          { clave: 'oportunidades' as const, texto: 'Oportunidades', señal: oportunidades.length },
        ]}
        activa={solapa}
        alElegir={setSolapa}
      />

      <div key={solapa} className="surge">
        <Filtro
          items={visibles}
          marcador="Buscar por nombre, cliente o código…"
          buscarEn={(f) => `${f.nombre} ${f.cliente} ${f.codigo} ${f.responsable ?? ''}`}
          recortes={recortes}
        >
          {(vistos) =>
            vistos.length === 0 ? (
              <p className="tarjeta px-4 py-10 text-center text-sm text-gris">
                {visibles.length === 0
                  ? solapa === 'proyectos'
                    ? 'Todavía no archivaste ningún proyecto.'
                    : 'Todavía no archivaste ninguna oportunidad.'
                  : 'Ninguno coincide con ese recorte.'}
              </p>
            ) : (
              <ul className="escalona flex flex-col gap-1.5">
                {vistos.map((f) => {
                  const c = CIERRE[f.color] ?? CIERRE.gris
                  const porque = f.motivo_rojo ?? f.motivo_gris
                  return (
                    <li
                      key={f.id}
                      className="tarjeta flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3"
                    >
                      <Link href={`/proyecto/${f.codigo}`} className="group min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-tinta
                                         transition-colors duration-150 group-hover:text-azul-hondo">
                          {f.nombre}
                        </span>
                        <span className="cifra block truncate text-2xs text-gris-50">
                          {f.cliente}
                          {f.servicio && ` · ${f.servicio}`}
                          {f.responsable && ` · ${f.responsable}`}
                        </span>
                      </Link>

                      <span className="w-32 shrink-0">
                        <span className={`block text-sm font-medium ${c.tono}`}>{c.texto}</span>
                        {porque && (
                          <span className="block text-2xs text-gris-50">{MOTIVO[porque] ?? porque}</span>
                        )}
                      </span>

                      <span className="w-28 shrink-0 text-right">
                        {f.era_oportunidad ? (
                          <span className="cifra block text-sm text-gris">
                            {f.monto_neto ? plata(f.monto_neto, f.moneda) : '—'}
                          </span>
                        ) : (
                          <>
                            <span className="cifra block text-sm font-medium text-tinta">
                              {plata(f.cobrado, f.moneda)}
                            </span>
                            <span className="block text-2xs text-gris-50">cobrado</span>
                          </>
                        )}
                      </span>

                      <span className="w-28 shrink-0 text-right">
                        <span className="cifra block text-2xs text-gris-50">
                          {fechaCorta(f.archivado_at.slice(0, 10))}
                        </span>
                        {f.archivado_por && (
                          <span className="block truncate text-2xs text-gris-25">
                            {f.archivado_por.split(' ')[0]}
                          </span>
                        )}
                      </span>

                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => correr(() => desarchivarProyecto(f.id))}
                        className="boton boton-secundario boton-chico shrink-0"
                      >
                        Restaurar
                      </button>
                    </li>
                  )
                })}
              </ul>
            )
          }
        </Filtro>
      </div>
    </div>
  )
}

'use client'

import Filtro, { type Recorte } from '@/components/Filtro'
import { Selector, useVista } from '@/components/Vistas'
import Tablero, { type Op } from '@/components/Tablero'
import ListaPipeline from '@/components/ListaPipeline'
import { type EtapaViva } from '@/lib/estados'

const RECORTES: Recorte<Op>[] = [
  {
    nombre: 'salud',
    vacio: 'Todo',
    opciones: [
      { valor: 'vencido', texto: 'Seguimiento vencido' },
      { valor: 'sin_agendar', texto: 'Sin agendar' },
      { valor: 'sin_monto', texto: 'Sin monto' },
      { valor: 'referido', texto: 'Vino por alguien' },
    ],
    aplica: (o, v) =>
      v === 'vencido'
        ? o.seguimiento_vencido
        : v === 'sin_agendar'
          ? o.sin_agendar
          : v === 'sin_monto'
            ? o.monto_neto === null
            : o.referente !== null,
  },
]

export default function VistaPipeline({
  ops,
  seguimientos,
  etapas,
  alta,
}: {
  ops: Op[]
  seguimientos: [string, string | null][]
  etapas: EtapaViva[]
  alta: React.ReactNode
}) {
  const vista = useVista('crossity.pipeline')
  const mapa = new Map(seguimientos)

  const recortes: Recorte<Op>[] = [
    {
      nombre: 'etapa',
      vacio: 'Todas las etapas',
      opciones: etapas.map((e) => ({ valor: e.valor, texto: e.etiqueta })),
      aplica: (o, v) => o.etapa === v,
    },
    ...RECORTES,
  ]

  return (
    <Filtro
      items={ops}
      marcador="Buscar por oportunidad, cliente o quién la trajo…"
      buscarEn={(o) => `${o.nombre} ${o.cliente} ${o.codigo} ${o.referente ?? ''}`}
      recortes={recortes}
    >
      {(vistos) => (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Selector clave="crossity.pipeline" vista={vista} />
            {alta}
          </div>

          <div key={vista} className="surge">
            {vista === 'lista' ? (
              <ListaPipeline ops={vistos} seguimientos={mapa} etapas={etapas} />
            ) : (
              <Tablero ops={vistos} etapas={etapas} />
            )}
          </div>
        </div>
      )}
    </Filtro>
  )
}

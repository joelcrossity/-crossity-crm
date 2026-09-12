'use client'

import Filtro, { type Recorte } from '@/components/Filtro'
import { Selector, useVista } from '@/components/Vistas'
import TableroEstados, { type Columna } from '@/components/TableroEstados'
import { Grupo, type Fila } from '@/components/TablaProyectos'

const RECORTES: Recorte<Fila>[] = [
  {
    nombre: 'estado',
    vacio: 'Todos los estados',
    opciones: [
      { valor: 'verde', texto: 'En vivo' },
      { valor: 'gris', texto: 'Frenado' },
      { valor: 'naranja', texto: 'Terminado' },
      { valor: 'rojo', texto: 'Perdido' },
    ],
    aplica: (f, v) => f.color === v,
  },
  {
    nombre: 'salud',
    vacio: 'Todo',
    opciones: [
      { valor: 'frenados', texto: 'Frenados' },
      { valor: 'sin_fecha', texto: 'Sin fecha' },
      { valor: 'sin_responsable', texto: 'Sin responsable' },
    ],
    aplica: (f, v) =>
      v === 'frenados'
        ? f.dias_sin_novedades > 7
        : v === 'sin_fecha'
          ? !f.fecha_comprometida
          : !f.responsable,
  },
]

export default function VistaProyectos({
  filas,
  alta,
  responsables,
  columnas,
}: {
  filas: Fila[]
  alta: React.ReactNode
  responsables: string[]
  columnas: Columna[]
}) {
  const vista = useVista('crossity.proyectos')

  const recortes: Recorte<Fila>[] = [
    ...RECORTES,
    {
      nombre: 'responsable',
      vacio: 'Cualquiera',
      opciones: responsables.map((r) => ({ valor: r, texto: r })),
      aplica: (f, v) => f.responsable === v,
    },
  ]

  return (
    <Filtro
      items={filas}
      marcador="Buscar por proyecto, cliente o código…"
      buscarEn={(f) => `${f.nombre} ${f.cliente} ${f.codigo} ${f.responsable ?? ''}`}
      recortes={recortes}
    >
      {(vistos) => (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Selector clave="crossity.proyectos" vista={vista} />
            {alta}
          </div>

          <div key={vista} className="surge">
            {vista === 'lista' ? (
              <div className="flex flex-col gap-8">
                {columnas.map((c) => (
                  <Grupo
                    key={c.clave}
                    color={c.color}
                    titulo={c.etiqueta}
                    ayuda={c.ayuda}
                    filas={vistos.filter(
                      (f) => f.color === c.color && (!c.motivo || f.motivo_gris === c.motivo),
                    )}
                  />
                ))}
              </div>
            ) : (
              <TableroEstados filas={vistos} columnas={columnas} />
            )}
          </div>
        </div>
      )}
    </Filtro>
  )
}

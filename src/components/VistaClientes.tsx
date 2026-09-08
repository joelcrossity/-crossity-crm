'use client'

import Filtro, { type Recorte } from '@/components/Filtro'
import { Selector, useVista } from '@/components/Vistas'
import GrillaClientes, { type Cuenta, type Chip } from '@/components/GrillaClientes'
import ListaCuentas from '@/components/ListaCuentas'

const RECORTES: Recorte<Cuenta>[] = [
  {
    nombre: 'situacion',
    vacio: 'Todas las cuentas',
    opciones: [
      { valor: 'activas', texto: 'Con trabajo abierto' },
      { valor: 'abonos', texto: 'Con abono' },
      { valor: 'pipeline', texto: 'Solo en pipeline' },
      { valor: 'dormidas', texto: 'Dormidas' },
      { valor: 'varias', texto: 'Facturan por varias' },
    ],
    aplica: (c, v) =>
      v === 'activas'
        ? c.en_vivo + c.abonos > 0
        : v === 'abonos'
          ? c.abonos > 0
          : v === 'pipeline'
            ? c.en_pipeline > 0 && c.en_vivo + c.abonos === 0
            : v === 'dormidas'
              ? c.en_vivo + c.abonos + c.en_pipeline === 0
              : c.razones_sociales > 1,
  },
]

export default function VistaClientes({
  cuentas,
  proyectos,
  alta,
}: {
  cuentas: Cuenta[]
  proyectos: [string, Chip[]][]
  alta: React.ReactNode
}) {
  const vista = useVista('crossity.clientes')
  const porCuenta = new Map(proyectos)

  return (
    <Filtro
      items={cuentas}
      marcador="Buscar por cliente, código o marca…"
      buscarEn={(c) =>
        `${c.cuenta} ${c.codigo} ${c.marcas ?? ''} ${(porCuenta.get(c.codigo) ?? [])
          .map((p) => p.nombre)
          .join(' ')}`
      }
      recortes={RECORTES}
    >
      {(vistos) => (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Selector clave="crossity.clientes" vista={vista} />
            {alta}
          </div>

          <div key={vista} className="surge">
            {vista === 'lista' ? (
              <ListaCuentas cuentas={vistos} porCuenta={porCuenta} />
            ) : (
              <GrillaClientes cuentas={vistos} porCuenta={porCuenta} />
            )}
          </div>
        </div>
      )}
    </Filtro>
  )
}

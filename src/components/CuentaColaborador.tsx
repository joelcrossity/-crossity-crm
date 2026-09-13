'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { registrarPago, revertirPago } from '@/app/acciones'
import { plata, fechaCorta } from '@/lib/estados'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   La cuenta corriente de alguien del equipo, entrega por entrega.

   El resumen de arriba ya dice cuánto tiene devengado y cuánto listo
   para cobrar. Lo que faltaba es de dónde sale cada peso: qué proyecto,
   qué etapa, qué porcentaje y en qué punto está.

   Eso es lo que hace que no haya que preguntar. Alguien que ve "te
   debemos 3.826.900" sin desglose tiene que confiar; viendo las cuatro
   etapas con su estado, verifica.

   Los cuatro estados son cuatro hechos distintos y conviene no
   confundirlos: comprometido es lo acordado, devengado es lo que se
   ganó y el cliente todavía no pagó, a liquidar es plata del cliente
   que ya entró, y liquidado es lo transferido. Solo se paga lo que está
   en a liquidar: prometer lo que no se cobró es cómo se llega a deber
   plata que no se tiene.
   ------------------------------------------------------------------ */

export type Porcion = {
  porcion_id: string
  proyecto_id: string
  codigo: string
  proyecto: string
  cliente: string
  entrega: string
  etapa: number | null
  concepto: string
  porcentaje: number
  vence_at: string | null
  entregado_at: string | null
  entrega_cobrada: string | null
  monto: number
  moneda: string
  estado: string
  en_pesos: number | null
  liquidacion_id: string | null
}

export type Pago = {
  liquidacion_id: string
  fecha: string
  notas: string | null
  codigo: string
  proyecto: string
  entrega: string
  porcion_id: string
  monto: number
  moneda: string
  monto_pagado: number | null
  moneda_pago: string | null
  caja: string | null
}

const ESTADO: Record<string, { texto: string; clase: string; ayuda: string }> = {
  comprometido: { texto: 'Acordado', clase: 'text-gris-50', ayuda: 'está en el acuerdo, la entrega no salió' },
  devengado: { texto: 'Devengado', clase: 'text-amarillo', ayuda: 'se ganó, el cliente todavía no pagó' },
  a_liquidar: { texto: 'A cobrar', clase: 'text-verde', ayuda: 'la plata del cliente ya entró' },
  liquidado: { texto: 'Cobrado', clase: 'text-gris', ayuda: 'ya se transfirió' },
}

export default function CuentaColaborador({
  porciones,
  pagos,
  cajas,
  puedePagar,
  hoy,
}: {
  porciones: Porcion[]
  pagos: Pago[]
  cajas: { id: string; nombre: string; moneda: string }[]
  /* Solo dirección y administración. El colaborador ve todo lo suyo
     pero no puede marcar que se le pagó: sería firmarse el recibo. */
  puedePagar: boolean
  hoy: string
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [abierto, setAbierto] = useState(false)
  const [fecha, setFecha] = useState(hoy)
  const [caja, setCaja] = useState('')
  const [notas, setNotas] = useState('')

  const porPagar = porciones.filter((p) => p.estado === 'a_liquidar')
  const total = porPagar
    .filter((p) => elegidas.has(p.porcion_id))
    .reduce((s, p) => s + Number(p.monto), 0)

  function alternar(id: string) {
    setElegidas((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function pagar() {
    setError(null)
    empezar(async () => {
      const r = await registrarPago([...elegidas], fecha, caja, notas)
      if (r.ok) {
        setElegidas(new Set())
        setAbierto(false)
        setNotas('')
      } else setError(r.error)
    })
  }

  /* Agrupadas por proyecto: una lista plana de doce entregas de tres
     proyectos no se lee, y la pregunta siempre es "cuánto me queda de
     este proyecto". */
  const porProyecto = [...new Map(porciones.map((p) => [p.proyecto_id, p])).values()]

  return (
    <div className="flex flex-col gap-9">
      {error && (
        <p role="alert" className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      <Seccion
        titulo="Entrega por entrega"
        ayuda="El porcentaje se aplica sobre lo que queda del proyecto después de gastos e impuestos. Solo se puede pagar lo que el cliente ya pagó."
        acciones={
          puedePagar && porPagar.length > 0 ? (
            <button
              type="button"
              onClick={() => setAbierto((v) => !v)}
              className="boton boton-principal boton-chico"
            >
              {abierto ? 'Cancelar' : 'Registrar un pago'}
            </button>
          ) : undefined
        }
      >
        {abierto && (
          <div className="surge flex flex-wrap items-end gap-3 rounded-lg border border-azul bg-azul-aire p-3">
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">Cuándo</span>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="campo cifra w-40"
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="rotulo">De qué caja</span>
              <select
                value={caja}
                onChange={(e) => setCaja(e.target.value)}
                className="campo w-48 cursor-pointer"
              >
                <option value="">sin registrar la caja</option>
                {cajas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} · {c.moneda}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-44 flex-1 flex-col gap-0.5">
              <span className="rotulo">Nota o comprobante</span>
              <input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Transferencia 1042"
                className="campo"
              />
            </label>
            <button
              type="button"
              onClick={pagar}
              disabled={pendiente || elegidas.size === 0}
              className="boton boton-principal"
            >
              {pendiente
                ? 'Registrando…'
                : elegidas.size === 0
                  ? 'Elegí las entregas'
                  : `Pagar ${plata(total, porPagar[0]?.moneda ?? 'ARS')}`}
            </button>
            <p className="w-full text-2xs text-gris-50">
              El saldo de la caja baja solo: no hay que cargar el egreso aparte. Si la caja está
              en otra moneda, se convierte con la cotización de cada entrega y queda registrado
              cuánto se transfirió de verdad.
            </p>
          </div>
        )}

        {porciones.length === 0 ? (
          <p className="tarjeta px-4 py-6 text-sm text-gris">
            Todavía no tiene participación cargada en ningún proyecto.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {porProyecto.map((cabeza) => {
              const suyas = porciones.filter((p) => p.proyecto_id === cabeza.proyecto_id)
              const suma = (e: string) =>
                suyas.filter((p) => p.estado === e).reduce((s, p) => s + Number(p.monto), 0)

              return (
                <div key={cabeza.proyecto_id} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <Link
                      href={`/proyecto/${cabeza.codigo}`}
                      className="group flex flex-wrap items-baseline gap-2"
                    >
                      <span className="text-sm font-bold tracking-tight text-tinta
                                       transition-colors duration-150 group-hover:text-azul-hondo">
                        {cabeza.proyecto}
                      </span>
                      <span className="text-2xs text-gris-50">
                        {cabeza.cliente} · {cabeza.concepto} {Number(cabeza.porcentaje)}%
                      </span>
                    </Link>
                    <span className="cifra flex gap-3 text-2xs">
                      {suma('a_liquidar') > 0 && (
                        <span className="font-medium text-verde">
                          {plata(suma('a_liquidar'), cabeza.moneda)} a cobrar
                        </span>
                      )}
                      {suma('devengado') > 0 && (
                        <span className="text-amarillo">
                          {plata(suma('devengado'), cabeza.moneda)} devengado
                        </span>
                      )}
                    </span>
                  </div>

                  <ul className="divide-y divide-linea overflow-hidden tarjeta">
                    {suyas.map((p) => {
                      const e = ESTADO[p.estado] ?? ESTADO.comprometido
                      const elegible = puedePagar && p.estado === 'a_liquidar' && abierto
                      return (
                        <li
                          key={p.porcion_id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2"
                        >
                          {elegible && (
                            <input
                              type="checkbox"
                              aria-label={`Pagar ${p.entrega}`}
                              checked={elegidas.has(p.porcion_id)}
                              onChange={() => alternar(p.porcion_id)}
                              className="size-4 shrink-0 accent-[var(--color-azul-hondo)]"
                            />
                          )}

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-tinta">
                              {p.etapa ? `${p.etapa}. ` : ''}
                              {p.entrega}
                            </span>
                            <span className="cifra block text-2xs text-gris-50">
                              {p.vence_at ? `vence ${fechaCorta(p.vence_at)}` : 'sin fecha'}
                              {p.entregado_at && ` · entregada ${fechaCorta(p.entregado_at)}`}
                            </span>
                          </span>

                          <span className="w-28 shrink-0 text-right">
                            <span className="cifra block text-sm font-medium text-tinta">
                              {plata(p.monto, p.moneda)}
                            </span>
                            {p.moneda !== 'ARS' && p.en_pesos != null && (
                              <span className="cifra block text-2xs text-gris-50">
                                {plata(p.en_pesos, 'ARS')}
                              </span>
                            )}
                          </span>

                          <span className={`w-24 shrink-0 text-right text-2xs ${e.clase}`} title={e.ayuda}>
                            {e.texto}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </div>
        )}
      </Seccion>

      <Seccion
        titulo="Lo que ya se le pagó"
        ayuda="Cada transferencia, con su fecha y de qué caja salió."
      >
        {pagos.length === 0 ? (
          <p className="tarjeta px-4 py-6 text-sm text-gris">Todavía no se le pagó nada.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {[...new Map(pagos.map((p) => [p.liquidacion_id, p])).values()].map((cabeza) => {
              const suyos = pagos.filter((p) => p.liquidacion_id === cabeza.liquidacion_id)
              const total = suyos.reduce((s, p) => s + Number(p.monto_pagado ?? p.monto), 0)
              return (
                <li key={cabeza.liquidacion_id} className="tarjeta flex flex-col gap-1.5 px-3.5 py-2.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="flex flex-wrap items-baseline gap-2">
                      <span className="cifra text-sm font-medium text-tinta">
                        {fechaCorta(cabeza.fecha)}
                      </span>
                      {cabeza.caja && <span className="text-2xs text-gris-50">de {cabeza.caja}</span>}
                      {cabeza.notas && <span className="text-2xs text-gris">{cabeza.notas}</span>}
                    </span>
                    <span className="cifra text-sm font-bold text-verde">
                      {plata(total, cabeza.moneda_pago ?? cabeza.moneda)}
                    </span>
                  </div>
                  <span className="text-2xs text-gris-50">
                    {suyos.map((p) => `${p.codigo} · ${p.entrega}`).join('  ·  ')}
                  </span>
                  {puedePagar && (
                    <button
                      type="button"
                      disabled={pendiente}
                      onClick={() =>
                        empezar(async () => {
                          const r = await revertirPago(cabeza.liquidacion_id)
                          if (!r.ok) setError(r.error)
                        })
                      }
                      className="w-fit text-2xs text-gris-50 transition-colors duration-150 hover:text-rojo"
                      title="Devuelve estas entregas a «a cobrar» y repone el saldo de la caja"
                    >
                      Deshacer este pago
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Seccion>
    </div>
  )
}

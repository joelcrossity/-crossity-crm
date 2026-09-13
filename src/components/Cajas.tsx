'use client'

import { useState, useTransition } from 'react'
import { archivarCaja, guardarCaja } from '@/app/acciones'
import { plata } from '@/lib/estados'

/* ------------------------------------------------------------------
   Dónde está la plata.

   Una caja no lleva saldo guardado: lo que se ve acá es la cuenta de lo
   que había antes del sistema más lo que entró menos lo que salió,
   hecha en la base cada vez que se mira. Por eso no hay un botón de
   "recalcular": no hay nada que pueda quedar desincronizado.

   El selector de arriba no convierte las cajas, cambia con qué vara se
   las mide. Una caja en dólares sigue teniendo dólares; verla en pesos
   es una pregunta sobre cuánto valen hoy, y la respuesta depende de qué
   dólar se use. Por eso el total dice siempre a cuál está valuado: un
   número grande sin esa aclaración invita a creer que es el único.
   ------------------------------------------------------------------ */

export type Caja = {
  id: string
  nombre: string
  moneda: string
  activa: boolean
  notas: string | null
  desde: string
  saldo_inicial: number
  entro: number
  salio: number
  saldo: number
  saldo_otra_oficial: number | null
  saldo_otra_blue: number | null
}

const VACIA = {
  id: undefined as string | undefined,
  nombre: '',
  moneda: 'ARS',
  saldo_inicial: '0',
  desde: new Date().toISOString().slice(0, 10),
  notas: '',
}

export default function Cajas({ cajas, puedeAdministrar }: { cajas: Caja[]; puedeAdministrar: boolean }) {
  const [ver, setVer] = useState<'propia' | 'ARS' | 'USD'>('propia')
  const [casa, setCasa] = useState<'oficial' | 'blue'>('oficial')
  const [form, setForm] = useState<typeof VACIA | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  const activas = cajas.filter((c) => c.activa)
  const apagadas = cajas.filter((c) => !c.activa)

  /* El saldo de una caja mirado con la vara elegida. Null cuando falta
     la cotización: no se muestra un cero, que se leería como una caja
     vacía en vez de como un dato que falta. */
  function conLaVara(c: Caja): { monto: number | null; moneda: string } {
    if (ver === 'propia' || ver === c.moneda) return { monto: c.saldo, moneda: c.moneda }
    const otra = casa === 'oficial' ? c.saldo_otra_oficial : c.saldo_otra_blue
    return { monto: otra, moneda: ver }
  }

  const totales =
    ver === 'propia'
      ? null
      : activas.reduce(
          (a, c) => {
            const { monto } = conLaVara(c)
            return monto === null ? { ...a, faltan: a.faltan + 1 } : { ...a, suma: a.suma + monto }
          },
          { suma: 0, faltan: 0 },
        )

  function guardar() {
    if (!form) return
    setError(null)
    empezar(async () => {
      const r = await guardarCaja({
        id: form.id,
        nombre: form.nombre,
        moneda: form.moneda,
        saldo_inicial: Number(form.saldo_inicial),
        desde: form.desde,
        notas: form.notas,
      })
      if (r.ok) setForm(null)
      else setError(r.error)
    })
  }

  function apagar(c: Caja) {
    setError(null)
    empezar(async () => {
      const r = await archivarCaja(c.id, !c.activa)
      if (!r.ok) setError(r.error)
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex rounded-md border border-linea p-0.5">
            {(['propia', 'ARS', 'USD'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVer(v)}
                className={`rounded px-2.5 py-1 text-2xs transition-colors duration-150 ${
                  ver === v ? 'bg-azul-aire font-medium text-azul-hondo' : 'text-gris'
                }`}
              >
                {v === 'propia' ? 'Cada una en lo suyo' : `Ver en ${v}`}
              </button>
            ))}
          </span>

          {ver !== 'propia' && (
            <span className="flex rounded-md border border-linea p-0.5">
              {(['oficial', 'blue'] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCasa(c)}
                  className={`rounded px-2.5 py-1 text-2xs transition-colors duration-150 ${
                    casa === c ? 'bg-azul-aire font-medium text-azul-hondo' : 'text-gris'
                  }`}
                >
                  {c === 'oficial' ? 'Oficial' : 'Blue'}
                </button>
              ))}
            </span>
          )}
        </div>

        {puedeAdministrar && !form && (
          <button type="button" onClick={() => setForm(VACIA)} className="boton boton-principal">
            Nueva caja
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}

      {form && (
        <div className="surge flex flex-wrap items-end gap-3 rounded-lg border border-azul bg-azul-aire p-3">
          <label className="flex flex-col gap-0.5">
            <span className="rotulo">Nombre</span>
            <input
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              placeholder="Banco Galicia"
              className="campo w-48"
              autoFocus
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="rotulo">Moneda</span>
            <select
              value={form.moneda}
              onChange={(e) => setForm({ ...form, moneda: e.target.value })}
              className="campo w-24 cursor-pointer"
              disabled={!!form.id}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="rotulo">Saldo al empezar</span>
            <input
              value={form.saldo_inicial}
              inputMode="decimal"
              onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })}
              className="campo cifra w-36"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="rotulo">Desde</span>
            <input
              type="date"
              value={form.desde}
              onChange={(e) => setForm({ ...form, desde: e.target.value })}
              className="campo cifra w-40"
            />
          </label>
          <button
            type="button"
            onClick={guardar}
            disabled={pendiente}
            className="boton boton-principal"
          >
            {pendiente ? 'Guardando…' : 'Guardar'}
          </button>
          <button type="button" onClick={() => setForm(null)} className="boton boton-sutil">
            Cancelar
          </button>
          <p className="w-full text-2xs text-gris-50">
            El saldo al empezar es lo que había antes de que el sistema existiera. De ahí en
            adelante la caja se mueve sola con los cobros y los pagos, y la moneda no se cambia:
            sería reinterpretar todo lo que ya entró.
          </p>
        </div>
      )}

      {activas.length === 0 ? (
        <p className="tarjeta px-4 py-10 text-center text-sm text-gris">
          Todavía no hay cajas. Creá una por cada lugar donde tenés plata: la cuenta del banco, el
          efectivo, los dólares.
        </p>
      ) : (
        <ul className="escalona grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {activas.map((c) => {
            const { monto, moneda } = conLaVara(c)
            const convertida = ver !== 'propia' && ver !== c.moneda
            return (
              <li key={c.id} className="tarjeta flex flex-col gap-2 p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-bold tracking-tight text-tinta">
                      {c.nombre}
                    </span>
                    <span className="text-2xs text-gris-50">{c.moneda}</span>
                  </span>
                  {puedeAdministrar && (
                    <span className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            id: c.id,
                            nombre: c.nombre,
                            moneda: c.moneda,
                            saldo_inicial: String(c.saldo_inicial),
                            desde: c.desde,
                            notas: c.notas ?? '',
                          })
                        }
                        className="text-2xs text-gris-50 transition-colors duration-150 hover:text-azul-hondo"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => apagar(c)}
                        disabled={pendiente}
                        title="Deja de aparecer, pero no se borra: los cobros que entraron por acá la siguen apuntando"
                        className="text-2xs text-gris-50 transition-colors duration-150 hover:text-rojo"
                      >
                        Apagar
                      </button>
                    </span>
                  )}
                </div>

                <span className="cifra text-xl font-bold tabular-nums text-tinta">
                  {monto === null ? (
                    <span className="text-base font-normal text-amarillo">
                      falta la cotización
                    </span>
                  ) : (
                    plata(monto, moneda)
                  )}
                </span>

                {convertida && monto !== null && (
                  <span className="text-2xs text-gris-50">
                    son {plata(c.saldo, c.moneda)} al {casa}
                  </span>
                )}

                <span className="flex gap-3 border-t border-linea pt-2 text-2xs text-gris-50">
                  <span className="cifra">+{plata(c.entro, c.moneda)}</span>
                  <span className="cifra">−{plata(c.salio, c.moneda)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {totales && (
        <p className="flex flex-wrap items-baseline gap-x-3 rounded-lg border border-linea bg-panel px-3.5 py-2.5">
          <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
            Todo junto
          </span>
          <span className="cifra text-lg font-bold tabular-nums text-tinta">
            {plata(totales.suma, ver)}
          </span>
          <span className="text-2xs text-gris-50">valuado al {casa}</span>
          {totales.faltan > 0 && (
            <span className="text-2xs text-amarillo">
              {totales.faltan} sin cotización, no está incluida
            </span>
          )}
        </p>
      )}

      {apagadas.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="rotulo">Apagadas</span>
          <ul className="flex flex-wrap gap-2">
            {apagadas.map((c) => (
              <li
                key={c.id}
                className="flex items-baseline gap-2 rounded-md border border-linea px-2.5 py-1.5"
              >
                <span className="text-2xs text-gris">{c.nombre}</span>
                <span className="cifra text-2xs text-gris-50">{plata(c.saldo, c.moneda)}</span>
                {puedeAdministrar && (
                  <button
                    type="button"
                    onClick={() => apagar(c)}
                    disabled={pendiente}
                    className="text-2xs text-azul-hondo"
                  >
                    Encender
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

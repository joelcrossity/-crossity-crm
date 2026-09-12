'use client'

import { useState, useTransition } from 'react'
import {
  borrarCuentaSuelta,
  repararVinculos,
  revisarAccesos,
  vincularCuenta,
  type Cuenta,
} from '@/app/acciones'
import { fechaCorta } from '@/lib/estados'
import { Seccion } from '@/components/ui'

/* ------------------------------------------------------------------
   Quién puede entrar, y si su cuenta encontró su ficha.

   Hay dos padrones: las cuentas de Supabase —que solo sirven para
   entrar— y las personas del CRM, que son quienes participan y cobran.
   Se vinculan por correo, y eso falla calladito cuando el orden no es
   el esperado o cuando una letra no coincide.

   El síntoma es siempre el mismo y desorienta: alguien entra y no ve
   nada. Acá se ve por qué, y se arregla sin borrar nada.
   ------------------------------------------------------------------ */

const campo = 'campo'

const rotulo = 'rotulo'

export default function Accesos({
  personas,
  yoSoy,
}: {
  personas: { id: string; nombre: string }[]
  yoSoy: string | null
}) {
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [datos, setDatos] = useState<{
    cuentas: Cuenta[]
    sinCuenta: { id: string; nombre: string; email: string }[]
  } | null>(null)
  const [eligiendo, setEligiendo] = useState<Record<string, string>>({})

  function revisar() {
    setError(null)
    setAviso(null)
    empezar(async () => {
      const r = await revisarAccesos()
      if (r.ok) setDatos({ cuentas: r.cuentas, sinCuenta: r.sinCuenta })
      else setError(r.error)
    })
  }

  function correr(fn: () => Promise<{ ok: boolean; error?: string }>, bien?: string) {
    setError(null)
    setAviso(null)
    empezar(async () => {
      const r = await fn()
      if (!r.ok) setError(r.error ?? 'No se pudo.')
      else {
        if (bien) setAviso(bien)
        const otra = await revisarAccesos()
        if (otra.ok) setDatos({ cuentas: otra.cuentas, sinCuenta: otra.sinCuenta })
      }
    })
  }

  const sueltas = datos?.cuentas.filter((c) => !c.persona) ?? []
  const unidas = datos?.cuentas.filter((c) => c.persona) ?? []

  return (
    <Seccion
      titulo="Cuentas y fichas"
      ayuda={
        <>
          Hay dos padrones: las <span className="font-medium text-tinta">cuentas</span>, que solo
          sirven para entrar, y las <span className="font-medium text-tinta">personas</span>, que son
          quienes participan y cobran. Se vinculan por correo. Cuando eso falla, alguien entra y no
          ve nada — y acá se ve por qué.
        </>
      }
      acciones={
        <button type="button" disabled={pendiente} onClick={revisar} className="boton boton-secundario">
          {pendiente ? 'Mirando…' : datos ? 'Volver a mirar' : 'Revisar los accesos'}
        </button>
      }
    >

      {error && (
        <p className="surge rounded-md border border-rojo bg-rojo-aire px-3 py-2 text-sm text-rojo">
          {error}
        </p>
      )}
      {aviso && (
        <p className="surge rounded-md border border-verde bg-verde-aire px-3 py-2 text-sm text-tinta">
          {aviso}
        </p>
      )}

      {datos && (
        <>
          {sueltas.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-md font-bold tracking-tight">Cuentas sin ficha</h3>
                  <p className="max-w-[70ch] text-sm text-gris">
                    Entran al sistema pero no ven nada, porque los permisos salen de la ficha. O se
                    vinculan a la persona que corresponde, o se borran.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pendiente}
                  onClick={() => correr(() => repararVinculos(), 'Vinculadas las que coincidían por correo.')}
                  className="boton boton-secundario boton-chico shrink-0"
                >
                  Vincular las que coincidan por correo
                </button>
              </div>

              <ul className="flex flex-col gap-1.5">
                {sueltas.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border
                               border-amarillo bg-amarillo-aire px-3.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium text-tinta">
                        {c.email}
                        {c.id === yoSoy && (
                          <span className="ml-2 text-2xs font-normal text-gris">sos vos</span>
                        )}
                      </span>
                      <span className="cifra block text-2xs text-gris">
                        creada {fechaCorta(c.creada.slice(0, 10))}
                        {c.confirmada ? '' : ' · sin confirmar'}
                        {c.ultimoIngreso
                          ? ` · entró el ${fechaCorta(c.ultimoIngreso.slice(0, 10))}`
                          : ' · nunca entró'}
                      </span>
                    </span>

                    <select
                      value={eligiendo[c.id] ?? ''}
                      onChange={(e) => setEligiendo((v) => ({ ...v, [c.id]: e.target.value }))}
                      className={`${campo} w-52 shrink-0`}
                      aria-label={`Vincular ${c.email}`}
                    >
                      <option value="">vincular con…</option>
                      {personas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={pendiente || !eligiendo[c.id]}
                      onClick={() =>
                        correr(() => vincularCuenta(c.id, eligiendo[c.id]), 'Cuenta vinculada.')
                      }
                      className="boton boton-principal boton-chico shrink-0"
                    >
                      Vincular
                    </button>

                    {c.id !== yoSoy && (
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => correr(() => borrarCuentaSuelta(c.id), 'Cuenta borrada.')}
                        className="boton boton-peligro boton-chico shrink-0"
                      >
                        Borrarla
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(datos.sinCuenta.length > 0) && (
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-0.5">
                <h3 className="text-md font-bold tracking-tight">Personas sin cuenta</h3>
                <p className="max-w-[70ch] text-sm text-gris">
                  No pueden entrar. No siempre es un problema: participar y cobrar no exige entrar.
                  Para las que sí tienen que entrar, el enlace se genera en su ficha.
                </p>
              </div>
              <ul className="flex flex-wrap gap-1.5">
                {datos.sinCuenta.map((p) => (
                  <li
                    key={p.id}
                    className="campo"
                  >
                    {p.nombre}
                    <span className="cifra ml-2 text-2xs text-gris-50">
                      {p.email || 'sin correo'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <h3 className={rotulo}>Cuentas en orden</h3>
            {unidas.length === 0 ? (
              <p className="tarjeta px-3.5 py-3 text-sm text-gris">
                Todavía ninguna.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {unidas.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1
                               tarjeta px-3.5 py-2"
                  >
                    <span className="text-base text-tinta">{c.persona!.nombre}</span>
                    <span className="cifra text-2xs text-gris-50">
                      {c.email}
                      {c.ultimoIngreso
                        ? ` · entró el ${fechaCorta(c.ultimoIngreso.slice(0, 10))}`
                        : ' · nunca entró'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Seccion>
  )
}

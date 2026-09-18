'use client'

import ElegirCliente, { type Cliente } from '@/components/ElegirCliente'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { anotarCharla } from '@/app/acciones'
import Dictado from '@/components/Dictado'

/* ------------------------------------------------------------------
   Anotar una charla, en veinte segundos.

   Este es el momento en que casi todo se pierde: hubo una reunión, hay
   interés, y todavía no existe ni el proyecto ni el alcance. El
   formulario largo mata ese registro. Éste pide cuatro cosas y ya deja
   el hilo abierto: después crece solo.
   ------------------------------------------------------------------ */

const campo = 'campo'

const rotulo = 'rotulo'

const ORIGENES: [string, string][] = [
  ['recomendacion', 'Nos recomendaron'],
  ['referido', 'Referido de alguien'],
  ['cliente_existente', 'Ya es cliente'],
  ['entrante_web', 'Entró por la web'],
  ['whatsapp', 'Escribió por WhatsApp'],
  ['evento', 'Lo conocimos en un evento'],
  ['salida_propia', 'Salimos a buscarlo'],
  ['otro', 'Otro'],
]

export default function Charla({
  clientes,
  siempreAbierto = false,
}: {
  clientes: Cliente[]
  siempreAbierto?: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(siempreAbierto)
  const [pendiente, empezar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [clienteNuevo, setClienteNuevo] = useState('')
  const [cuitNuevo, setCuitNuevo] = useState('')
  const [tema, setTema] = useState('')
  const [loHablado, setLoHablado] = useState('')
  const [origen, setOrigen] = useState('')
  const [cuando, setCuando] = useState('')
  const [referidoPor, setReferidoPor] = useState('')
  const [referidoNota, setReferidoNota] = useState('')
  /* Con quién se habló. Plegado porque no siempre se tiene, y un
     formulario que pide seis datos para anotar una charla es un
     formulario que se llena a medias o no se llena. */
  const [conQuien, setConQuien] = useState(false)
  const [cNombre, setCNombre] = useState('')
  const [cRol, setCRol] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cTel, setCTel] = useState('')

  /* Se abre en blanco. El resguardo automático que había acá ofrecía
     recuperar charlas que nadie había escrito: bastaba abrir y cerrar
     para dejar un borrador vacío guardado. */
  function vaciar() {
    setClienteId('')
    setClienteNuevo('')
    setCuitNuevo('')
    setTema('')
    setLoHablado('')
    setReferidoPor('')
    setReferidoNota('')
    setConQuien(false)
    setCNombre('')
    setCRol('')
    setCEmail('')
    setCTel('')

    /* Y se tira el resguardo que pudo quedar guardado de antes. Sacar
       la función del código no borra lo que ya está en la máquina de
       cada uno, y son datos de clientes: se van con el primer uso. */
    try {
      window.localStorage.removeItem('borrador:charla')
    } catch {
      // Sin permiso para tocar el almacenamiento no hay nada guardado.
    }
  }

  const elegido = clientes.find((c) => c.id === clienteId)

  if (!abierto)
    return (
      <button
        type="button"
        onClick={() => {
          vaciar()
          setAbierto(true)
        }}
        className="w-fit rounded-md border border-linea-fuerte px-3.5 py-1.5 text-sm font-medium
                   text-gris transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
      >
        Anotar una charla
      </button>
    )

  return (
    <div className="flex w-full flex-col gap-4 rounded-lg border border-azul bg-azul-aire p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-bold tracking-tight text-tinta">Anotar una charla</h2>
        <p className="max-w-[70ch] text-sm text-gris">
          Para cuando hubo una reunión o una llamada y todavía no hay proyecto. Queda como
          oportunidad en interés: el alcance, el monto y las entregas se cargan cuando existan.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <span className={rotulo}>Con quién</span>
          <ElegirCliente
            clientes={clientes}
            elegido={clienteId}
            nombreNuevo={clienteNuevo}
            alElegir={setClienteId}
            alEscribirNuevo={setClienteNuevo}
            cuitNuevo={cuitNuevo}
            alEscribirCuit={setCuitNuevo}
            autoFoco
            extras={[
              {
                valor: 'sin_definir',
                texto: 'Todavía no sé de quién es',
                ayuda: 'abre una cuenta provisoria',
              },
            ]}
          />
          {elegido && elegido.proyectos > 0 && (
            <span className="text-2xs text-azul-hondo">
              Ya es cliente: esto se suma a su ficha, no abre otra.
            </span>
          )}
          {clienteId === 'sin_definir' && (
            <span className="text-2xs text-gris-50">
              Queda en espera y te lo va a recordar la campanita hasta que le pongas nombre.
            </span>
          )}
        </div>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>De dónde salió</span>
          <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={campo}>
            <option value="">sin cargar</option>
            {ORIGENES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {(origen === 'recomendacion' || origen === 'referido') && (
          <>
            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>Quién lo trajo</span>
              <input
                value={referidoPor}
                onChange={(e) => setReferidoPor(e.target.value)}
                placeholder="Nombre y apellido"
                className={campo}
              />
              <span className="text-2xs text-gris-50">
                Si ya nos refirió antes, se reconoce y no se duplica.
              </span>
            </label>

            <label className="flex flex-col gap-0.5">
              <span className={rotulo}>Qué se habló de su comisión</span>
              <input
                value={referidoNota}
                onChange={(e) => setReferidoNota(e.target.value)}
                placeholder="Nada todavía, o «con un 10 % está bien»"
                className={campo}
              />
              <span className="text-2xs text-gris-50">
                El porcentaje lo cierra administración cuando haya monto.
              </span>
            </label>
          </>
        )}

        {/* El contacto va al cliente, no a la charla: la próxima vez que
            aparezca ese cliente, el mail ya está donde se lo busca. Por
            eso son los campos del contacto de verdad y no dos casillas
            sueltas acá. */}
        {conQuien ? (
          <div className="flex flex-col gap-3 rounded-md border border-linea px-3 py-3">
            <span className="flex items-baseline justify-between gap-3">
              <span className={rotulo}>Con quién hablaste</span>
              <button
                type="button"
                onClick={() => setConQuien(false)}
                className="text-2xs text-gris-50 transition-colors duration-150 hover:text-tinta"
              >
                No hace falta
              </button>
            </span>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-0.5">
                <span className={rotulo}>Nombre</span>
                <input
                  value={cNombre}
                  onChange={(e) => setCNombre(e.target.value)}
                  placeholder="Carolina Méndez"
                  className={campo}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className={rotulo}>Qué hace ahí</span>
                <input
                  value={cRol}
                  onChange={(e) => setCRol(e.target.value)}
                  placeholder="Gerenta de operaciones"
                  className={campo}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className={rotulo}>Email</span>
                <input
                  value={cEmail}
                  type="email"
                  onChange={(e) => setCEmail(e.target.value)}
                  placeholder="carolina@empresa.com"
                  className={campo}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className={rotulo}>Teléfono</span>
                <input
                  value={cTel}
                  onChange={(e) => setCTel(e.target.value)}
                  placeholder="343 4123456"
                  className={campo}
                />
              </label>
            </div>

            <span className="text-2xs text-gris-50">
              Queda como contacto del cliente, así que la próxima vez ya está cargado. Con el
              nombre alcanza; el resto se puede completar después.
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConQuien(true)}
            className="w-fit text-2xs text-gris-50 underline underline-offset-2
                       transition-colors duration-150 hover:text-azul-hondo"
          >
            + Anotar con quién hablaste
          </button>
        )}

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Tema, si ya hay uno</span>
          <input
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder="Sitio nuevo, o dejalo vacío"
            className={campo}
          />
          <span className="text-2xs text-gris-50">Si todavía no se sabe, queda “Por definir”.</span>
        </label>

        <label className="flex flex-col gap-0.5">
          <span className={rotulo}>Cuándo se vuelve a hablar</span>
          <input
            type="date"
            value={cuando}
            onChange={(e) => setCuando(e.target.value)}
            className={`${campo} cifra`}
          />
          <span className="text-2xs text-gris-50">
            Sin esta fecha la charla se apaga sola y nadie se entera.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span className={rotulo}>De qué hablaron</span>
          <Dictado
            etiqueta="Contalo hablando"
            alDictar={(t) => setLoHablado((v) => (v ? `${v} ${t}` : t).replace(/\s+/g, ' '))}
          />
        </span>
        <textarea
          value={loHablado}
          onChange={(e) => setLoHablado(e.target.value)}
          rows={3}
          placeholder="Quiere ordenar la parte de ventas. No sabe todavía si es un sitio o un sistema. Mueve mucho por WhatsApp."
          className={`${campo} resize-y`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() => {
            setError(null)
            empezar(async () => {
              const r = await anotarCharla({
                clienteId, clienteNuevo, cuitNuevo, tema, loHablado, origen, cuando, referidoPor, referidoNota,
                contactoNombre: cNombre,
                contactoRol: cRol,
                contactoEmail: cEmail,
                contactoTelefono: cTel,
              })
              if (r.ok) {
                vaciar()
                if (r.ir) router.push(r.ir)
              } else setError(r.error)
            })
          }}
          className="boton boton-principal"
        >
          {pendiente ? 'Anotando…' : 'Anotar la charla'}
        </button>
        {!siempreAbierto && (
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="boton boton-sutil"
          >
            Cancelar
          </button>
        )}

        {error && <span className="text-sm text-rojo">{error}</span>}
      </div>
    </div>
  )
}

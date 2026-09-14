'use client'

import ElegirCliente, { type Cliente } from '@/components/ElegirCliente'
import ElegirPersona from '@/components/ElegirPersona'
import { AvisoBorrador, EstadoDelBorrador } from '@/components/ui'
import { useBorrador } from '@/lib/borrador'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { crearProyectoCompleto, type HitoNuevo } from '@/app/acciones'
import { plata } from '@/lib/estados'

const campo = 'campo'

const PASOS = ['Cliente', 'El proyecto', 'Las entregas'] as const

/* Plantillas de cobro. Se eligen y después se editan: lo que se acordó
   nunca entra exacto en una plantilla, pero arrancar de cero es peor. */
const PLANTILLAS: Record<string, { texto: string; detalle: string; partes: number[] }> = {
  mitades: { texto: '50 / 50', detalle: 'anticipo y contra entrega', partes: [50, 50] },
  tercios: { texto: 'Tres partes', detalle: 'anticipo, avance y cierre', partes: [40, 30, 30] },
  cuatro: { texto: 'Cuatro entregas', detalle: 'como SUINO', partes: [13.64, 50, 22.73, 13.63] },
  una: { texto: 'Todo junto', detalle: 'una sola entrega', partes: [100] },
}

function vacio(): HitoNuevo {
  return { titulo: '', entregable: '', monto: '', fecha: '' }
}

function aNumero(v: string) {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

export default function Asistente({
  clientes,
  personas,
  arrancaComo = 'proyecto',
  clienteFijo,
  puedeCargar = true,
}: {
  clientes: Cliente[]
  personas: { id: string; nombre: string }[]
  arrancaComo?: 'proyecto' | 'oportunidad'
  /* Cuando se entra desde la ficha de un cliente ya se sabe para quién
     es. Volver a pedirlo es hacer buscar algo que la pantalla ya tiene
     en el título. */
  clienteFijo?: { id: string; nombre: string }
  /* Quién puede abrir trabajo. Se pregunta en el servidor y llega acá
     para no hacerle cargar tres pasos a alguien que va a rebotar al
     final. La base decide igual: esto es cortesía, no la cerradura. */
  puedeCargar?: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [paso, setPaso] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  const [clienteId, setClienteId] = useState(clienteFijo?.id ?? '')
  const [clienteNuevo, setClienteNuevo] = useState('')
  const [cuitNuevo, setCuitNuevo] = useState('')
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [moneda, setMoneda] = useState('ARS')
  const [iva, setIva] = useState('21')
  const [programa, setPrograma] = useState('')
  const [responsableId, setResponsableId] = useState('')
  const [responsableTecnicoId, setResponsableTecnicoId] = useState('')
  const [hitos, setHitos] = useState<HitoNuevo[]>([])

  /* El formulario más largo del sistema: nombre, monto, moneda, IVA,
     dos responsables y las entregas una por una. Perderlo por cerrar
     una pestaña es media hora de trabajo. */
  const campos = {
    clienteId, clienteNuevo, cuitNuevo, nombre, monto, moneda, iva,
    programa, responsableId, responsableTecnicoId, hitos,
  }
  const borrador = useBorrador(`alta:${arrancaComo}`, campos, abierto)

  function recuperar() {
    const previo = borrador.restaurar()
    if (!previo) return
    if (!clienteFijo) setClienteId(previo.clienteId)
    setClienteNuevo(previo.clienteNuevo)
    setCuitNuevo(previo.cuitNuevo)
    setNombre(previo.nombre)
    setMonto(previo.monto)
    setMoneda(previo.moneda)
    setIva(previo.iva)
    setPrograma(previo.programa)
    setResponsableId(previo.responsableId)
    setResponsableTecnicoId(previo.responsableTecnicoId)
    setHitos(previo.hitos)
  }

  const elegido = clientes.find((c) => c.id === clienteId)
  const esOportunidad = arrancaComo === 'oportunidad'

  const sumaHitos = hitos.reduce((a, h) => a + aNumero(h.monto), 0)
  const totalProyecto = aNumero(monto)
  const descuadre = totalProyecto > 0 && hitos.length > 0 ? sumaHitos - totalProyecto : 0

  function aplicarPlantilla(clave: string) {
    const base = totalProyecto
    setHitos(
      PLANTILLAS[clave].partes.map((pct, i) => ({
        titulo: `${i + 1}ª entrega`,
        entregable: '',
        monto: base > 0 ? Math.round((base * pct) / 100).toString() : '',
        fecha: '',
      }))
    )
  }

  function cambiarHito(i: number, campo: keyof HitoNuevo, valor: string) {
    setHitos((prev) => prev.map((h, j) => (i === j ? { ...h, [campo]: valor } : h)))
  }

  function cerrar() {
    setAbierto(false)
    setPaso(0)
    setError(null)
  }

  const puedeSeguir =
    paso === 0
      ? clienteId === 'nuevo'
        ? clienteNuevo.trim().length > 0
        : clienteId.length > 0
      : paso === 1
        ? nombre.trim().length > 0
        : true

  function crear() {
    setError(null)
    empezar(async () => {
      const r = await crearProyectoCompleto({
        clienteId,
        clienteNuevo,
        cuitNuevo,
        nombre,
        monto,
        moneda,
        iva,
        programa,
        responsableId,
        responsableTecnicoId,
        arranca: arrancaComo,
        hitos,
      })
      if (r.ok) {
        // Guardado: el borrador ya no sirve y ofrecerlo la próxima vez
        // sería ofrecer algo que ya está cargado en el sistema.
        borrador.olvidar()
        if (r.ir) router.push(r.ir)
      } else setError(r.error)
    })
  }

  if (!abierto) {
    /* Se muestra apagado y con el motivo, no escondido. Un botón que
       falta hace buscarlo; uno apagado que dice por qué se entiende de
       una y le dice a quién pedirle el permiso. */
    if (!puedeCargar) {
      return (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <button
            type="button"
            disabled
            className="w-fit cursor-not-allowed rounded-md bg-gris-25 px-3.5 py-1.5
                       text-sm font-medium text-gris-50"
          >
            {esOportunidad ? 'Nueva oportunidad' : 'Nuevo proyecto'}
          </button>
          <span className="text-2xs text-gris-50">
            lo abren dirección, administración, coordinación, vendedores y project managers
          </span>
        </span>
      )
    }

    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-fit rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                   transition-colors duration-150 hover:bg-azul"
      >
        {esOportunidad ? 'Nueva oportunidad' : 'Nuevo proyecto'}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-azul bg-azul-aire p-5">
      <ol className="flex flex-wrap gap-x-2 gap-y-1">
        {PASOS.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 rounded-md px-2 py-0.5 text-sm ${
                i === paso
                  ? 'bg-azul-hondo font-medium text-white'
                  : i < paso
                    ? 'text-azul-hondo'
                    : 'text-gris-50'
              }`}
            >
              <span className="cifra text-2xs">{i + 1}</span>
              {p}
            </span>
            {i < PASOS.length - 1 && <span className="text-gris-50">›</span>}
          </li>
        ))}
      </ol>

      <AvisoBorrador
        hay={!!borrador.hay}
        alRestaurar={recuperar}
        alDescartar={borrador.olvidar}
      />

      {paso === 0 && (
        <div className="flex flex-col gap-3">
          <Titulo texto="¿Para quién es?" ayuda="El proyecto casi siempre aparece antes que el cliente. Si es alguien nuevo, se da de alta acá." />
          {clienteFijo ? (
            <p className="flex items-baseline gap-2 rounded-md border border-linea bg-panel px-3 py-2">
              <span className="text-2xs uppercase tracking-wider text-gris-50">Para</span>
              <span className="text-sm font-medium text-tinta">{clienteFijo.nombre}</span>
            </p>
          ) : (
          <ElegirCliente
            clientes={clientes}
            elegido={clienteId}
            nombreNuevo={clienteNuevo}
            alElegir={setClienteId}
            alEscribirNuevo={setClienteNuevo}
            cuitNuevo={cuitNuevo}
            alEscribirCuit={setCuitNuevo}
            autoFoco
          />
          )}

          {elegido && (
            <Nota>
              {elegido.proyectos === 0
                ? 'Cliente sin historia todavía: éste sería el primero.'
                : `Ya tiene ${elegido.proyectos} proyecto${elegido.proyectos > 1 ? 's' : ''} en la cuenta${
                    elegido.enVivo > 0 ? `, ${elegido.enVivo} en vivo` : ''
                  }.`}
            </Nota>
          )}
        </div>
      )}

      {paso === 1 && (
        <div className="flex flex-col gap-3">
          <Titulo
            texto="¿Qué es y cuánto?"
            ayuda={
              esOportunidad
                ? 'El monto puede esperar: recién hace falta cuando haya cotización.'
                : 'El monto va sin IVA. El total con IVA se calcula solo.'
            }
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-0.5">
              <Etiqueta>Qué es</Etiqueta>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="ERP 360, autogestión y tracking"
                className={`${campo} w-72`}
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <Etiqueta>Monto neto</Etiqueta>
              <input
                inputMode="decimal"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="11000000"
                className={`${campo} cifra w-32 text-right`}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <Etiqueta>Moneda</Etiqueta>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                className={`${campo} w-20 cursor-pointer`}
              >
                <option>ARS</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5">
              <Etiqueta>Programa</Etiqueta>
              <input
                value={programa}
                onChange={(e) => setPrograma(e.target.value)}
                placeholder="Kit 4.0"
                className={`${campo} w-32`}
              />
            </label>
          </div>

          {/* Con el botón de alta: la persona que falta en la lista
              suele ser justo la que entró esta semana, y abandonar el
              formulario para darla de alta es perder todo lo cargado. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ElegirPersona
              personas={personas}
              elegida={responsableId}
              alElegir={setResponsableId}
              etiqueta="Responsable del proyecto"
            />
            <ElegirPersona
              personas={personas}
              elegida={responsableTecnicoId}
              alElegir={setResponsableTecnicoId}
              etiqueta="Responsable técnico"
            />
          </div>

          <label className="flex w-40 flex-col gap-0.5">
            <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">IVA</span>
            <select value={iva} onChange={(e) => setIva(e.target.value)} className={campo}>
              <option value="21">21 %</option>
              <option value="10.5">10,5 %</option>
              <option value="27">27 %</option>
              <option value="0">No lleva IVA</option>
            </select>
          </label>

          {totalProyecto > 0 && (
            <Nota>
              {iva === '0'
                ? `Sin IVA: ${plata(totalProyecto, moneda)}.`
                : `Con IVA: ${plata(Math.round(totalProyecto * (1 + Number(iva) / 100)), moneda)}.`}
            </Nota>
          )}
        </div>
      )}

      {paso === 2 && (
        <div className="flex flex-col gap-4">
          <Titulo
            texto="¿Cómo se entrega y se cobra?"
            ayuda="Cada entrega lleva su fecha, qué se entrega y cuánto se cobra. Los tres juntos: una fecha sin entregable no dice qué se comprometió, y un monto sin fecha no dice cuándo entra."
          />

          {hitos.length === 0 ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm text-gris">Elegí cómo se reparte, y después lo ajustás:</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(PLANTILLAS).map(([clave, p]) => (
                  <button
                    key={clave}
                    type="button"
                    onClick={() => aplicarPlantilla(clave)}
                    className="flex flex-col rounded-md border border-linea bg-superficie px-3 py-2
                               text-left transition-colors duration-150 hover:border-azul"
                  >
                    <span className="text-sm font-medium text-tinta">{p.texto}</span>
                    <span className="text-2xs text-gris-50">{p.detalle}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setHitos([vacio()])}
                  className="rounded-md border border-linea bg-superficie px-3 py-2 text-sm text-gris
                             transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
                >
                  Armarlas a mano
                </button>
              </div>
              <Nota>
                Se puede crear sin entregas y cargarlas después, pero el avance y la cobranza no
                van a decir nada hasta que existan.
              </Nota>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="overflow-x-auto tarjeta">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-linea bg-panel">
                      {['#', 'Entrega', 'Qué conlleva', 'Monto', 'Fecha', ''].map((h, i) => (
                        <th key={i} className="px-2 py-2 text-left text-2xs font-medium uppercase tracking-wider text-gris-50">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hitos.map((h, i) => (
                      <tr key={i} className="border-b border-linea last:border-0">
                        <td className="cifra px-2 py-1.5 text-2xs text-gris-50">
                          {i + 1}
                          {i === 0 && <span className="block text-azul-hondo">anticipo</span>}
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            value={h.titulo}
                            onChange={(e) => cambiarHito(i, 'titulo', e.target.value)}
                            placeholder={`${i + 1}ª entrega`}
                            className={`${campo} w-32`}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            value={h.entregable}
                            onChange={(e) => cambiarHito(i, 'entregable', e.target.value)}
                            placeholder="Informe y mapa de puntos de captura"
                            className={`${campo} w-64`}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            inputMode="decimal"
                            value={h.monto}
                            onChange={(e) => cambiarHito(i, 'monto', e.target.value)}
                            className={`${campo} cifra w-28 text-right`}
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          <input
                            type="date"
                            value={h.fecha}
                            onChange={(e) => cambiarHito(i, 'fecha', e.target.value)}
                            className={`${campo} cifra w-32`}
                          />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            aria-label={`Sacar la entrega ${i + 1}`}
                            onClick={() => setHitos((p) => p.filter((_, j) => j !== i))}
                            className="text-gris-50 transition-colors duration-150 hover:text-rojo"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setHitos((p) => [...p, vacio()])}
                  className="boton boton-secundario boton-chico transition-colors duration-150 hover:border-azul hover:text-azul-hondo"
                >
                  Sumar una entrega
                </button>
                <span className="cifra text-sm">
                  <span className="text-gris-50">suma de entregas </span>
                  <span className={descuadre !== 0 ? 'font-bold text-amarillo' : 'font-bold text-tinta'}>
                    {plata(sumaHitos, moneda)}
                  </span>
                </span>
              </div>

              {descuadre !== 0 && (
                <Nota tono="amarillo">
                  Las entregas suman {plata(Math.abs(descuadre), moneda)}{' '}
                  {descuadre > 0 ? 'más' : 'menos'} que el monto del proyecto. No lo impido: puede
                  ser a propósito. Pero conviene mirarlo antes de crear.
                </Nota>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-rojo">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 border-t border-azul/30 pt-4">
        {paso > 0 && (
          <button
            type="button"
            onClick={() => setPaso(paso - 1)}
            className="rounded-md border border-linea bg-superficie px-3 py-1.5 text-sm text-gris
                       transition-colors duration-150 hover:text-tinta"
          >
            Volver
          </button>
        )}

        {paso < PASOS.length - 1 ? (
          <button
            type="button"
            disabled={!puedeSeguir}
            onClick={() => setPaso(paso + 1)}
            className="rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                       transition-colors duration-150 hover:bg-azul
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            Seguir
          </button>
        ) : (
          <button
            type="button"
            disabled={pendiente || !nombre.trim()}
            onClick={crear}
            className="rounded-md bg-azul-hondo px-3.5 py-1.5 text-sm font-medium text-white
                       transition-colors duration-150 hover:bg-azul
                       disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pendiente
              ? 'Creando…'
              : hitos.length > 0
                ? `Crear con ${hitos.length} entrega${hitos.length > 1 ? 's' : ''}`
                : 'Crear'}
          </button>
        )}

        <button
          type="button"
          onClick={cerrar}
          className="boton boton-sutil"
        >
          Cancelar
        </button>

        {/* Cancelar no borra el borrador a propósito: se cierra mucho
            sin querer, y lo que se escribió tiene que seguir ahí. */}
        <EstadoDelBorrador estado={borrador.estado} />

        {paso === PASOS.length - 1 && nombre.trim() && (
          <span className="text-2xs text-gris-50">
            {clienteId === 'nuevo' ? clienteNuevo : elegido?.nombre} · {nombre}
            {totalProyecto > 0 ? ` · ${plata(totalProyecto, moneda)}` : ''}
          </span>
        )}
      </div>
    </div>
  )
}

function Titulo({ texto, ayuda }: { texto: string; ayuda: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 className="text-md font-bold tracking-tight text-tinta">{texto}</h2>
      <p className="max-w-[70ch] text-sm text-gris">{ayuda}</p>
    </div>
  )
}

function Etiqueta({ children, acento }: { children: React.ReactNode; acento?: boolean }) {
  return (
    <span
      className={`text-2xs font-medium uppercase tracking-wider ${
        acento ? 'text-azul-hondo' : 'text-gris-50'
      }`}
    >
      {children}
    </span>
  )
}

function Nota({ children, tono }: { children: React.ReactNode; tono?: 'amarillo' }) {
  return (
    <p className={`max-w-[70ch] text-2xs ${tono === 'amarillo' ? 'text-amarillo' : 'text-gris-50'}`}>
      {children}
    </p>
  )
}

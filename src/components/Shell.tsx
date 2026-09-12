import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import Campanita, { type Aviso } from '@/components/Campanita'
import MenuUsuario from '@/components/MenuUsuario'
import Tema from '@/components/Tema'
import Buscador from '@/components/Buscador'
import { GRUPOS, NOMBRE_ROL, SECCIONES, puedeVer, rolPrincipal } from '@/lib/permisos'
import { plata } from '@/lib/estados'
import { ICONOS } from '@/components/Iconos'

type Pulso = {
  en_vivo: number
  atrasados: number
  frenados: number
  en_pipeline: number
  seguimientos_vencidos: number
  por_cobrar: number
  abonos: number
}

/* La navegación sale del mapa de permisos, no de una lista fija: así
   la pantalla y el menú no pueden discrepar sobre quién ve qué. */

export default async function Shell({
  children,
  activo,
  titulo,
}: {
  children: React.ReactNode
  activo: string
  titulo?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('usuarios')
    .select('personas(nombre, roles)')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  const yo = data?.personas as unknown as { nombre: string; roles: string[] } | undefined
  const misRoles = yo?.roles ?? []

  const navegacion = GRUPOS.map((grupo) => ({
    grupo,
    items: Object.entries(SECCIONES)
      .filter(([ruta, s]) => s.grupo === grupo && puedeVer(ruta, misRoles))
      .map(([ruta, s]) => ({ href: ruta, ...s })),
  })).filter((g) => g.items.length > 0)
  const iniciales = yo?.nombre.split(' ').map((p) => p[0]).slice(0, 2).join('') ?? '?'

  const [{ data: crudos }, { data: lectura }, { data: pulso }] = await Promise.all([
    supabase.from('v_campanita').select('*').order('momento', { ascending: false }).limit(40),
    supabase.from('lecturas').select('campanita_at').maybeSingle(),
    supabase.from('v_estado_general').select('*').maybeSingle(),
  ])

  /* Sin marca de lectura, todo es nuevo: la primera vez que alguien
     abre el sistema tiene que ver lo que se venía acumulando. */
  const desde = (lectura?.campanita_at as string | undefined) ?? null
  const avisos: Aviso[] = ((crudos ?? []) as Record<string, unknown>[]).map((a) => ({
    clave: a.clave as string,
    clase: a.clase as string,
    momento: (a.momento as string) ?? null,
    titulo: a.titulo as string,
    proyecto: (a.proyecto as string) ?? null,
    codigo: (a.codigo as string) ?? null,
    es_mi_plata: !!a.es_mi_plata,
    urgencia: (a.urgencia as string) ?? 'normal',
    // Lo que va a pasar no se "lee": sigue pendiente hasta que se resuelve.
    nuevo: a.clase !== 'paso' || !desde || (a.momento as string) > desde,
  }))

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside
        className="vidrio flex shrink-0 flex-col gap-7 border-b px-4 py-4
                   lg:sticky lg:top-0 lg:h-dvh lg:w-60 lg:border-r lg:border-b-0 lg:py-6"
      >
        {/* El logotipo, no la palabra escrita con otra tipografía. El
            manual fija el mínimo sin eslogan en 23 px de alto y una zona
            de protección alrededor: los 28 px y el padding salen de ahí,
            no de lo que quedaba lindo. */}
        <Link href="/hoy" className="w-fit px-2 py-1" aria-label="Crossity — ir al inicio">
          <Image
            src="/marca/crossity.png"
            alt="Crossity"
            width={1060}
            height={300}
            priority
            className="h-7 w-auto"
          />
        </Link>

        <nav className="flex flex-1 flex-wrap gap-x-4 gap-y-3 lg:flex-col lg:flex-nowrap lg:gap-4">
          {navegacion.map((g) => (
            <div key={g.grupo ?? 'raiz'} className="flex flex-col gap-0.5">
              {g.grupo && (
                <span className="hidden px-2.5 pb-0.5 text-2xs font-medium uppercase tracking-wider text-gris-50 lg:block">
                  {g.grupo}
                </span>
              )}
              <span className="flex flex-wrap gap-1 lg:flex-col lg:gap-0.5">
                {g.items.map((item) => {
                  const aca = activo === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.detalle}
                      aria-current={aca ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-2.5
                                  py-2 text-base transition-colors duration-150 ${
                                    aca
                                      ? 'bg-azul-aire font-semibold text-azul-hondo'
                                      : 'text-gris hover:bg-superficie hover:text-tinta'
                                  }`}
                    >
                      <span className={aca ? 'text-azul-hondo' : 'text-gris-50'}>
                        {ICONOS[item.href]}
                      </span>
                      {item.nombre}
                    </Link>
                  )
                })}
              </span>
            </div>
          ))}
        </nav>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Los avisos van donde se los busca: arriba y a la derecha. En
            la barra lateral el desplegable quedaba apretado contra el
            borde y encima había que ir a buscarlo a un lugar raro. */}
        <div className="vidrio sticky top-0 z-(--z-fijo) flex flex-col border-b">
          {/* Grilla y no flex: con justify-between, una vista donde
              falta el nombre de la sección corre los controles de lugar,
              y la barra deja de verse igual en todas las pantallas. */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5 lg:px-10">
            <span className="min-w-0 truncate text-base font-medium text-tinta">
              {titulo ?? SECCIONES[activo]?.nombre ?? 'Crossity'}
            </span>

            <span className="flex items-center gap-2.5">
              <Buscador />
              <Tema />
              <Campanita avisos={avisos} />

              {yo && (
                <MenuUsuario
                  nombre={yo.nombre}
                  rol={NOMBRE_ROL[rolPrincipal(misRoles) ?? ''] ?? 'sin rol'}
                  roles={misRoles}
                  iniciales={iniciales}
                />
              )}
            </span>
          </div>

          <Franja pulso={pulso as Pulso | null} />
        </div>

        <div className="px-5 py-8 lg:px-10 lg:py-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </div>
      </main>
    </div>
  )
}

export function Titulo({
  seccion,
  children,
  bajada,
  acciones,
}: {
  seccion: string
  children: React.ReactNode
  bajada?: React.ReactNode
  acciones?: React.ReactNode
}) {
  return (
    <header className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-linea pb-5">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-2xs font-medium uppercase tracking-wider text-gris-50">
          {seccion}
        </span>
        <h1 className="text-2xl font-bold tracking-tight text-balance">{children}</h1>
        {bajada && <p className="max-w-[65ch] text-base text-gris">{bajada}</p>}
      </div>
      {acciones}
    </header>
  )
}


/* ------------------------------------------------------------------
   Migas de pan.

   No es adorno: en una ficha se entra desde tres lados distintos —el
   tablero, la campanita, el cliente— y sin esto no hay forma de saber
   de dónde viniste ni de volver sin perder el hilo.
   ------------------------------------------------------------------ */

export function Rastro({
  pasos,
}: {
  pasos: { texto: string; href?: string }[]
}) {
  return (
    <nav aria-label="Dónde estás" className="mb-3 flex flex-wrap items-center gap-1.5 text-2xs">
      {pasos.map((p, i) => (
        <span key={p.texto} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="text-linea-fuerte" aria-hidden>
              /
            </span>
          )}
          {p.href ? (
            <Link
              href={p.href}
              className="text-gris-50 transition-colors duration-150 hover:text-azul-hondo"
            >
              {p.texto}
            </Link>
          ) : (
            <span className="text-gris">{p.texto}</span>
          )}
        </span>
      ))}
    </nav>
  )
}


/* ------------------------------------------------------------------
   La franja de estado.

   Cuatro señales de cómo viene la empresa, fijas arriba en todas las
   pantallas. El dato también está en Hoy: lo que agrega acá es que no
   haya que ir a buscarlo. Si algo está en rojo, se ve mientras estás
   haciendo otra cosa, que es cuando importa.
   ------------------------------------------------------------------ */

function Franja({ pulso }: { pulso: Pulso | null }) {
  if (!pulso) return null

  const señales: { rotulo: string; valor: string; nota?: string; alarma: boolean; href: string }[] = [
    {
      rotulo: 'En vivo',
      valor: String(pulso.en_vivo),
      nota:
        pulso.frenados > 0
          ? `${pulso.frenados} frenado${pulso.frenados > 1 ? 's' : ''}`
          : pulso.abonos > 0
            ? `+ ${pulso.abonos} abonos`
            : undefined,
      alarma: pulso.frenados > 0,
      href: '/tablero',
    },
    {
      rotulo: 'Atrasados',
      valor: String(pulso.atrasados),
      nota: pulso.atrasados > 0 ? 'pasaron la fecha' : 'ninguno',
      alarma: pulso.atrasados > 0,
      href: '/tablero',
    },
    {
      rotulo: 'Por cobrar',
      valor: plata(pulso.por_cobrar),
      nota: 'facturado sin entrar',
      alarma: pulso.por_cobrar > 0,
      href: '/admin',
    },
    {
      rotulo: 'Pipeline',
      valor: String(pulso.en_pipeline),
      nota:
        pulso.seguimientos_vencidos > 0
          ? `${pulso.seguimientos_vencidos} vencido${pulso.seguimientos_vencidos > 1 ? 's' : ''}`
          : 'al día',
      alarma: pulso.seguimientos_vencidos > 0,
      href: '/pipeline',
    },
  ]

  return (
    <div className="riel flex gap-x-6 overflow-x-auto border-t border-linea px-5 py-1.5 lg:px-10">
      {señales.map((s) => (
        <Link
          key={s.rotulo}
          href={s.href}
          className="group flex shrink-0 items-baseline gap-1.5 text-2xs"
        >
          <span
            className={`size-1.5 shrink-0 self-center rounded-full ${
              s.alarma ? 'bg-rojo' : 'bg-verde'
            }`}
            aria-hidden
          />
          <span className="font-medium uppercase tracking-wider text-gris-50">{s.rotulo}</span>
          <span
            className={`cifra font-bold transition-colors duration-150 ${
              s.alarma ? 'text-rojo' : 'text-tinta'
            } group-hover:text-azul-hondo`}
          >
            {s.valor}
          </span>
          {s.nota && <span className="text-gris-50">{s.nota}</span>}
        </Link>
      ))}
    </div>
  )
}

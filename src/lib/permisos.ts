/* ------------------------------------------------------------------
   Qué secciones ve cada rol.

   Esto NO es la seguridad: la seguridad está en la base, en las
   políticas por fila, y ahí seguirá aunque alguien escriba la URL a
   mano. Esto es otra cosa y también hace falta: que nadie vea en el
   menú una puerta que no puede abrir.

   Un menú con seis puertas cerradas no es más seguro, es más confuso.
   Y una pantalla que se abre vacía porque la base no devolvió nada se
   lee como un error del sistema, no como una decisión.
   ------------------------------------------------------------------ */

export type Rol =
  | 'direccion'
  | 'coordinacion'
  | 'project_manager'
  | 'vendedor'
  | 'administracion'
  | 'desarrollo'

export const NOMBRE_ROL: Record<string, string> = {
  direccion: 'Dirección',
  coordinacion: 'Coordinación',
  project_manager: 'Project manager',
  vendedor: 'Vendedor',
  administracion: 'Administración',
  desarrollo: 'Desarrollo',
}

/* El orden importa: cuando alguien tiene varios, se muestra el de más
   arriba. Mostrar la lista entera en la barra es ruido — lo que ubica
   es saber con qué sombrero está entrando. */
const JERARQUIA: Rol[] = [
  'direccion',
  'administracion',
  'coordinacion',
  'project_manager',
  'vendedor',
  'desarrollo',
]

export function rolPrincipal(roles: string[]): string | null {
  return JERARQUIA.find((r) => roles.includes(r)) ?? roles[0] ?? null
}

/* Quién ve cada sección. `todos` significa que la pantalla ya se filtra
   sola por lo que la persona puede ver, así que abrirla siempre tiene
   sentido: va a mostrar lo suyo. */
export const SECCIONES: Record<
  string,
  { ve: Rol[] | 'todos'; nombre: string; detalle: string; grupo: string | null }
> = {
  '/hoy': { ve: 'todos', nombre: 'Hoy', detalle: 'lo que necesita atención', grupo: null },

  '/pipeline': {
    ve: ['direccion', 'coordinacion', 'project_manager', 'vendedor'],
    nombre: 'Pipeline',
    detalle: 'lo enviado y por seguir',
    grupo: 'Trabajo',
  },
  '/tablero': { ve: 'todos', nombre: 'Proyectos', detalle: 'todo lo que está en curso', grupo: 'Trabajo' },
  '/mantenimientos': {
    ve: ['direccion', 'coordinacion', 'administracion', 'project_manager'],
    nombre: 'Mantenimiento',
    detalle: 'los abonos que ya están andando',
    grupo: 'Trabajo',
  },
  '/cuentas': {
    ve: ['direccion', 'coordinacion', 'project_manager', 'vendedor', 'administracion'],
    nombre: 'Clientes',
    detalle: 'las cuentas y sus marcas',
    grupo: 'Trabajo',
  },

  '/agenda': { ve: 'todos', nombre: 'Agenda', detalle: 'todo lo que tiene fecha', grupo: 'Financiero' },
  '/admin': {
    ve: ['direccion', 'administracion'],
    nombre: 'Administración',
    detalle: 'cobranza, caja y posición',
    grupo: 'Financiero',
  },
  '/mi-posicion': { ve: 'todos', nombre: 'Mi posición', detalle: 'lo que me toca cobrar', grupo: 'Financiero' },

  '/equipo': {
    ve: ['direccion', 'administracion', 'coordinacion'],
    nombre: 'Usuarios y roles',
    detalle: 'quién es quién y qué ve cada uno',
    grupo: 'Sistema',
  },
  '/etapas': {
    ve: ['direccion'],
    nombre: 'Etapas y estados',
    detalle: 'cómo vende la agencia',
    grupo: 'Sistema',
  },
}

export function puedeVer(ruta: string, roles: string[]): boolean {
  const s = SECCIONES[ruta]
  if (!s) return true
  if (s.ve === 'todos') return true
  return s.ve.some((r) => roles.includes(r))
}

export const GRUPOS = [null, 'Trabajo', 'Financiero', 'Sistema'] as const

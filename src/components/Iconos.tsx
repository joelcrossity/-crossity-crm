/* ------------------------------------------------------------------
   Iconos de la navegación.

   Dibujados a mano y no una librería: son ocho, pesan cero y así
   comparten el mismo trazo geométrico del logo en vez de traer el
   estilo de otro. Todos en currentColor y sobre la misma grilla de 16,
   para que el activo y el inactivo se vean iguales salvo el color.
   ------------------------------------------------------------------ */

const base = {
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'size-4 shrink-0',
  'aria-hidden': true,
}

export const ICONOS: Record<string, React.ReactNode> = {
  // Hoy: un sol bajo, lo que hay que mirar ahora
  '/hoy': (
    <svg {...base}>
      <circle cx="8" cy="8" r="2.6" />
      <path d="M8 1.6v1.4M8 13v1.4M14.4 8H13M3 8H1.6M12.5 3.5l-1 1M4.5 11.5l-1 1M12.5 12.5l-1-1M4.5 4.5l-1-1" />
    </svg>
  ),
  // Pipeline: un embudo
  '/pipeline': (
    <svg {...base}>
      <path d="M1.8 2.5h12.4l-4.7 5.4v5l-3-1.6V7.9L1.8 2.5Z" />
    </svg>
  ),
  // Proyectos: columnas de un tablero
  '/tablero': (
    <svg {...base}>
      <rect x="2" y="2.5" width="4" height="11" rx="1" />
      <rect x="10" y="2.5" width="4" height="7" rx="1" />
    </svg>
  ),
  // Mantenimiento: el ciclo que se repite
  '/mantenimientos': (
    <svg {...base}>
      <path d="M13.6 7.3a5.6 5.6 0 0 0-9.9-2.6M2.4 8.7a5.6 5.6 0 0 0 9.9 2.6" />
      <path d="M13.9 3.6v3.6h-3.6M2.1 12.4V8.8h3.6" />
    </svg>
  ),
  // Clientes: dos personas, la relación
  '/cuentas': (
    <svg {...base}>
      <circle cx="6" cy="5.5" r="2.3" />
      <path d="M1.9 13.5c0-2.3 1.8-3.8 4.1-3.8s4.1 1.5 4.1 3.8" />
      <path d="M11 3.5a2.3 2.3 0 0 1 0 4.4M12.2 9.9c1.2.5 1.9 1.6 1.9 3.1" />
    </svg>
  ),
  // Agenda: un calendario
  '/agenda': (
    <svg {...base}>
      <rect x="2" y="3.2" width="12" height="10.8" rx="1.6" />
      <path d="M2 6.4h12M5.4 1.9v2.6M10.6 1.9v2.6" />
    </svg>
  ),
  // Administración: una carpeta con papeles
  '/admin': (
    <svg {...base}>
      <path d="M2 4.2a1.4 1.4 0 0 1 1.4-1.4h2.6L7.4 4.4h5.2A1.4 1.4 0 0 1 14 5.8v6.4a1.4 1.4 0 0 1-1.4 1.4H3.4A1.4 1.4 0 0 1 2 12.2V4.2Z" />
      <path d="M5.2 9.4h5.6M5.2 11.4h3.4" />
    </svg>
  ),
  // Mi posición: una billetera
  '/mi-posicion': (
    <svg {...base}>
      <rect x="1.9" y="3.6" width="12.2" height="8.8" rx="1.6" />
      <path d="M1.9 6.6h12.2" />
      <circle cx="11.2" cy="9.8" r="0.9" />
    </svg>
  ),
  // Equipo: nodos unidos, la metáfora de la marca
  '/equipo': (
    <svg {...base}>
      <circle cx="8" cy="3.4" r="1.7" />
      <circle cx="3.4" cy="11.6" r="1.7" />
      <circle cx="12.6" cy="11.6" r="1.7" />
      <path d="M6.7 4.9 4.5 10M9.3 4.9l2.2 5.1M5.1 11.6h5.8" />
    </svg>
  ),
  // Nueva charla
  '/charla': (
    <svg {...base}>
      <path d="M14 9.2a2 2 0 0 1-2 2H5.6L2 14V4.2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5Z" />
    </svg>
  ),
}

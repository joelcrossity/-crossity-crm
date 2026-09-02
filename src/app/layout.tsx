import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'

// Metrópolis, la familia del manual. Light para aire, Regular para
// cuerpo, Bold para jerarquía, Black para el impacto puntual.
const metropolis = localFont({
  src: [
    { path: '../fuentes/Metropolis-Light.otf',   weight: '300', style: 'normal' },
    { path: '../fuentes/Metropolis-Regular.otf', weight: '400', style: 'normal' },
    { path: '../fuentes/Metropolis-Bold.otf',    weight: '700', style: 'normal' },
    { path: '../fuentes/Metropolis-Black.otf',   weight: '900', style: 'normal' },
  ],
  variable: '--fuente-metropolis',
  display: 'swap',
  fallback: ['Open Sans', 'system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: 'Sistema Operativo Crossity',
  description: 'Clientes, proyectos y liquidaciones de Crossity',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={metropolis.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}

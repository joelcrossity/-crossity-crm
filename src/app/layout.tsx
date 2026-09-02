import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

// Una sola familia: es una herramienta, no una portada.
const inter = Inter({
  subsets: ['latin'],
  variable: '--fuente-ui',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Sistema Operativo Crossity',
  description: 'Clientes, proyectos y liquidaciones de Crossity',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body className="font-sans">{children}</body>
    </html>
  )
}

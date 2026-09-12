import Link from 'next/link'

/* Una pantalla que se abre vacía porque la base no devolvió nada se lee
   como un error del sistema. Esto dice lo que pasa y adónde ir, que es
   lo único útil en ese momento. */

export default function SinAcceso({ que }: { que: string }) {
  return (
    <div className="surge mx-auto flex max-w-md flex-col items-start gap-3 py-16">
      <span className="grid size-10 place-items-center rounded-full bg-panel text-gris-50">
        <svg viewBox="0 0 20 20" className="size-5" fill="none" aria-hidden>
          <rect x="4" y="8.6" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <path d="M7 8.6V6.4a3 3 0 0 1 6 0v2.2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </span>
      <h1 className="text-xl font-bold tracking-tight text-tinta">{que} no es para tu rol</h1>
      <p className="text-sm text-gris">
        Si creés que deberías verlo, pedíselo a dirección o administración: los accesos se dan por
        rol y se pueden abrir por proyecto.
      </p>
      <Link href="/hoy" className="boton boton-secundario">
        Ir a Hoy
      </Link>
    </div>
  )
}

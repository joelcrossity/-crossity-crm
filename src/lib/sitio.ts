/* De dónde es este sistema.
 *
 * Vive en un solo lugar porque aparece en los enlaces que se le mandan
 * a la gente, y una dirección vieja en un correo de acceso no se puede
 * corregir después: ya salió.
 *
 * Sin el prefijo NEXT_PUBLIC a propósito. No es que sea secreta —es la
 * dirección que uno escribe en el navegador— sino que solo se usa del
 * lado del servidor, y una variable que no necesita estar en el paquete
 * que baja el navegador no tiene por qué estar ahí. Lo que no viaja no
 * se filtra.
 *
 * Con dominio propio cargado usa ése. Si no, cae en la dirección que
 * Vercel le da al despliegue, que funciona pero dice el proveedor y el
 * nombre de la cuenta.
 */
export function sitio() {
  const propio = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/+$/, '')
  if (propio) return propio

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  if (vercel) return `https://${vercel}`

  return 'http://localhost:3000'
}

import Shell from '@/components/Shell'
import Esqueleto from '@/components/Esqueleto'

export default function Cargando() {
  return (
    <Shell activo="/mantenimientos">
      <Esqueleto cifras={3} renglones={5} />
    </Shell>
  )
}

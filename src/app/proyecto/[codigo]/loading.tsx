import Shell from '@/components/Shell'
import Esqueleto from '@/components/Esqueleto'

export default function Cargando() {
  return (
    <Shell activo="/proyecto">
      <Esqueleto cifras={4} renglones={4} />
    </Shell>
  )
}

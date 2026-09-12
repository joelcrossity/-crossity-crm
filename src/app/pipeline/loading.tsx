import Shell from '@/components/Shell'
import Esqueleto from '@/components/Esqueleto'

export default function Cargando() {
  return (
    <Shell activo="/pipeline">
      <Esqueleto cifras={3} renglones={6} />
    </Shell>
  )
}

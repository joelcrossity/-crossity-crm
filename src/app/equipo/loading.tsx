import Shell from '@/components/Shell'
import Esqueleto from '@/components/Esqueleto'

export default function Cargando() {
  return (
    <Shell activo="/equipo">
      <Esqueleto cifras={0} renglones={6} />
    </Shell>
  )
}

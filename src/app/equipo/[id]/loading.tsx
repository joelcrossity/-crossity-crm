import Shell from '@/components/Shell'
import Esqueleto from '@/components/Esqueleto'

export default function Cargando() {
  return (
    <Shell activo="/equipo">
      <Esqueleto cifras={4} renglones={5} />
    </Shell>
  )
}

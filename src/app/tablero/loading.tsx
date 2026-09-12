import Shell from '@/components/Shell'
import Esqueleto from '@/components/Esqueleto'

export default function Cargando() {
  return (
    <Shell activo="/tablero">
      <Esqueleto cifras={0} renglones={7} />
    </Shell>
  )
}

import {
  Seccion,
  Lista as ListaUI,
  Fila as FilaUI,
  Cuerpo,
  Dato,
  Punto,
} from '@/components/ui'
import { SUBESTADO, fechaCorta } from '@/lib/estados'

export type Fila = {
  id: string
  codigo: string
  nombre: string
  cliente: string
  color: string
  subestado: string | null
  motivo_gris: string | null
  prioridad: number | null
  fecha_comprometida: string | null
  es_producto_propio: boolean
  responsable: string | null
  dias_sin_novedades: number
}


const TITULO: Record<string, { texto: string; ayuda: string }> = {
  verde:    { texto: 'En vivo',   ayuda: 'se está trabajando ahora' },
  amarillo: { texto: 'A seguir',  ayuda: 'la pelota está del otro lado' },
  gris:     { texto: 'Frenado',   ayuda: 'ganado y sin avanzar' },
  naranja:  { texto: 'Terminado', ayuda: 'no hay nada más que hacer' },
  rojo:     { texto: 'Perdido',   ayuda: 'salió mal o se descartó' },
}

export function Grupo({ color, filas }: { color: string; filas: Fila[] }) {
  if (filas.length === 0) return null
  const t = TITULO[color]

  return (
    <Seccion
      titulo={t.texto}
      cuantos={filas.length}
      ayuda={t.ayuda}
    >
      <ListaUI>
        {filas.map((f) => (
          <FilaUI key={f.id} href={`/proyecto/${f.codigo}`}>
            <Punto color={color} />
            <Cuerpo
              titulo={f.nombre}
              detalle={
                <>
                  {f.cliente}
                  {f.responsable ? ` · ${f.responsable}` : ' · sin responsable'}
                  {f.subestado ? ` · ${SUBESTADO[f.subestado] ?? f.subestado}` : ''}
                </>
              }
            />

            <Dato
              ancho="w-24"
              tono={f.fecha_comprometida ? 'gris' : 'amarillo'}
              valor={fechaCorta(f.fecha_comprometida) ?? 'sin fecha'}
              nota={color === 'verde' ? 'entrega' : undefined}
            />

            {color === 'verde' && f.dias_sin_novedades > 7 && (
              <Dato
                ancho="w-20"
                tono="rojo"
                valor={`${f.dias_sin_novedades} d`}
                nota="sin novedades"
              />
            )}
          </FilaUI>
        ))}
      </ListaUI>
    </Seccion>
  )
}

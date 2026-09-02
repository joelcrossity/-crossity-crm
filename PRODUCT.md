# Sistema Operativo Crossity

## Qué es

El sistema interno de una agencia de software de seis personas en Paraná, Entre Ríos.
Clientes, proyectos, participaciones y liquidaciones en un solo lugar.

No es un CRM de ventas. Crossity no tiene problema para vender: tiene quince
proyectos vendidos y en curso. El problema es entregarlos sin que su director sea
el centro de todo.

## El problema que resuelve

Joel es el motor de la empresa, no su índice. Se adelanta a componer planillas de
estado, a avisar que entraron los pagos, a gestionar al cliente que se atrasó,
porque sabe que si no empuja, no se mueve. Con quince proyectos simultáneos eso
dejó de escalar.

La causa raíz: no existe una noción compartida de qué es lo más importante y para
cuándo. Sin prioridad y sin fecha comprometida, la única fuente de priorización de
la empresa es él.

## El criterio de éxito

Seis trabajos que hoy hace a mano y el sistema tiene que dejar de necesitar:

1. Componer el estado de cada proyecto
2. Adelantarse a informarle al cliente
3. Avisar que están los pagos
4. Liquidarle a cada profesional lo suyo
5. Dar la orden de arranque cuando entra la seña
6. Perseguir al cliente que se atrasó

Si al terminar sigue haciendo esos seis, el proyecto falló.

## Quiénes lo usan

| | rol | entra |
|---|---|---|
| Joel Lifschitz | dirección | sí |
| Triana Lifschitz | administración | sí |
| Germán Gatti | project manager y vendedor | sí |
| Claudio Gervasoni | desarrollo | no |
| Santiago Díaz | desarrollo | no |
| Tomás Laurie | coordinación | no |

La mitad del equipo participa de los proyectos y cobra sin abrir el sistema: se
entera por notificación. Por eso el aviso tiene que contener la información, no un
enlace para ir a buscarla.

## La regla que gobierna todo

**Si actualizar el estado es trabajo extra, el equipo no lo hace.** A las tres
semanas los datos quedan viejos, nadie confía, y todos vuelven a preguntarle a
Joel, ahora con un sistema abandonado encima. Toda pantalla se juzga por cuánta
fricción agrega, no por cuánto muestra.

De ahí sale la regla de los formularios: cuantos menos campos, más temprano. Un
interés se carga con tres campos en diez segundos. El monto recién es obligatorio
cuando hay cotización.

## Vocabulario

El semáforo es de la empresa, no del sistema. Se usa tal cual lo dicen ellos:

- **verde** en vivo, se está trabajando
- **amarillo** se envió, hay que seguirlo
- **gris** standby, ni muerto ni vivo
- **naranja** terminado, no hay nada más que hacer
- **rojo** perdido o descartado

Y dos palabras que importan: la **cuenta** es la relación con el cliente y puede
agrupar varias razones sociales; la **apertura** es cuánto ve una persona de la
economía de un proyecto puntual.

## Permisos

Cada uno ve todo lo suyo de la plata y nada de lo del otro. Dirección y
administración ven el conjunto.

La apertura se decide por persona y por proyecto, no por rol: la misma persona
puede ser socio abierto donde también armó la propuesta y estar a ciegas donde
sólo desarrolla. Tres niveles: el total del proyecto, la propuesta y los
entregables, o sólo lo suyo.

Todo esto vive en la base con RLS. La interfaz nunca decide qué esconder.

## Register

product

## Stack

Next.js 16 App Router, React 19, Tailwind v4, Supabase.

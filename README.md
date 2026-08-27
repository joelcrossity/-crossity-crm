# Sistema Operativo Crossity

Clientes, proyectos, participaciones y liquidaciones de la agencia.
El alcance y el porqué de cada decisión están en el documento de arquitectura.

## Correr en local

Hace falta **Docker Desktop andando** y la CLI de Supabase.

```bash
npm install
supabase start
supabase db reset      # aplica migraciones y carga el seed
```

Después, las variables de entorno. `supabase start` las imprime;
para copiarlas a `.env.local`:

```bash
supabase status -o env | grep -E '^(API_URL|ANON_KEY)=' \
  | sed 's/^API_URL=/NEXT_PUBLIC_SUPABASE_URL=/; s/^ANON_KEY=/NEXT_PUBLIC_SUPABASE_ANON_KEY=/' \
  > .env.local
```

Y a andar:

```bash
npm run dev
```

### Usuarios de prueba

Los crea el seed, sólo para local. La contraseña está en `supabase/seed.sql`.

| Correo | Persona | Rol | Qué debería ver |
|---|---|---|---|
| `joel@crossity.ar` | Joel Lifschitz | dirección | los 37 proyectos |
| `triana@crossity.ar` | Triana Lifschitz | administración | todo menos la negociación comercial |
| `claudio@crossity.ar` | Claudio Gervasoni | desarrollo | sólo SUINO, y sólo su participación |

Entrar con los tres es la forma más rápida de comprobar que los permisos
hacen lo que dicen hacer.

### Si Kong devuelve 502 después de un `db reset`

Se queda con la referencia vieja al contenedor de auth:

```bash
docker restart supabase_kong_crossity-crm
```

## Estructura

```
supabase/migrations/
  ...esquema_base.sql      tablas, tipos y restricciones
  ...traza_y_calculo.sql   eventos append-only, reparto y compuerta del anticipo
  ...permisos.sql          RLS y vistas
  ...grants.sql            permisos de tabla
supabase/seed.sql          padrón, clientes y los 37 proyectos reales
src/app/                   tablero y login
src/lib/supabase/          clientes de servidor y navegador
src/proxy.ts               redirección por sesión (en Next 16 reemplaza a middleware)
```

## Reglas que no se negocian

- **La traza es append-only.** `eventos` no se modifica ni se borra, ni siquiera
  desde dirección. Un registro editable no prueba nada.
- **El estado se registra con disparadores de base**, no con código en cada
  pantalla: si dependiera de acordarse, quedarían agujeros.
- **La transparencia se decide por participación**, no por rol. La misma persona
  puede ser socio abierto en un proyecto y contratado a ciegas en otro.
- **Cada uno ve todo lo suyo de la plata y nada de lo del otro.**
- **Los gastos guardan neto, alícuota e IVA por separado.** Si el IVA está
  discriminado es crédito fiscal y se descuenta el neto; si no, el total.

## Pasar a la nube

Las migraciones son las mismas. Con el proyecto creado en Supabase:

```bash
supabase link --project-ref <ref>
supabase db push
```

Y cambiar las dos variables de `.env.local` por las del proyecto remoto.

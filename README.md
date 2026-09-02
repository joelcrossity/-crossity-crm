# Sistema Operativo Crossity

Clientes, proyectos, participaciones y liquidaciones de la agencia.
El alcance y el porqué de cada decisión están en el documento de arquitectura.

## Dónde vive

La base está en Supabase, proyecto **Crm-Crossity**. No hace falta Docker.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Las dos variables son públicas: la anon key viaja al navegador por diseño.
Quien manda es RLS, no el hecho de tener la key.

## Dar de alta a alguien

En Supabase → Authentication → Users → Add user, con **Auto Confirm**.
Si ya existe una persona con ese correo en el padrón, el vínculo con su rol
se arma solo. Quien se dé de alta con un correo que no está en el padrón
entra sin permisos: el alta la decide el padrón, no quien se registra.

## Cambios en la base

```bash
supabase db push        # aplica las migraciones nuevas al proyecto
```

Nunca se toca el esquema desde el panel: si no está en una migración, no
existe.

### Usuarios de prueba

Los crea el seed, sólo para local. La contraseña está en `supabase/seed.sql`.

| Correo | Persona | Rol | Qué debería ver |
|---|---|---|---|
| `joel@crossity.ar` | Joel Lifschitz | dirección | todo |
| `triana@crossity.ar` | Triana Lifschitz | administración | todo menos la negociación comercial |

**En la v1 entran solamente esos dos.** Claudio, Santiago, Germán y Tomás
participan de los proyectos y cobran su parte, pero no tienen cuenta: se
enteran por notificación.

Cuatro de seis personas van a vivir el sistema sin abrirlo nunca. Por eso el
aviso tiene que contener la información y no un enlace: un enlace es inútil
para quien no puede entrar.

Entrar con los dos es la forma más rápida de comprobar que los permisos hacen
lo que dicen hacer.

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

## Validar SQL sin tocar la nube

Un Postgres efímero con Postgres.app alcanza para probar migraciones:

```bash
export PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH"
initdb -D /tmp/pgtest -U postgres --auth=trust
pg_ctl -D /tmp/pgtest -o "-p 55432 -k /tmp" -l /tmp/pgtest/log start
```

Antes de las migraciones hay que crear los sustitutos de Supabase: la
extensión pgcrypto, el esquema `auth`, los roles `anon` y `authenticated`,
la tabla `auth.users` y una función `auth.uid()` que lea
`request.jwt.claims`.

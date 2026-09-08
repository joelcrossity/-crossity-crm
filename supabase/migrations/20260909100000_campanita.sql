-- ============================================================
-- La campanita.
--
-- Decisión de fondo: una notificación NO es una fila que alguien se
-- acuerda de insertar. Es una lectura sobre lo que ya pasó.
--
-- Los triggers ya escriben cada cambio en `eventos`, con su visibilidad
-- y con `afecta_persona` cuando toca la plata de alguien. Si además
-- hubiera que insertar a mano una notificación en cada lugar, la mitad
-- se olvidaría y la campanita mentiría. Se deriva, y así no puede
-- desincronizarse de la verdad.
--
-- Tiene dos fuentes, porque son dos cosas distintas:
--   1. Pasó algo   → viene de `eventos`
--   2. Va a pasar  → no es un evento, es un estado: una fecha que se
--                    acerca, un seguimiento vencido, algo frenado
-- ============================================================

-- ------------------------------------------------------------
-- Hasta dónde leyó cada uno.
-- ------------------------------------------------------------

create table lecturas (
  persona_id   uuid primary key references personas(id) on delete cascade,
  campanita_at timestamptz not null default now()
);

alter table lecturas enable row level security;

create policy lecturas_propias on lecturas for select to authenticated
  using (persona_id = persona_actual());
create policy lecturas_alta on lecturas for insert to authenticated
  with check (persona_id = persona_actual());
create policy lecturas_cambio on lecturas for update to authenticated
  using (persona_id = persona_actual()) with check (persona_id = persona_actual());

grant select, insert, update on lecturas to authenticated;

comment on table lecturas is
  'Una marca por persona, no una copia de cada aviso. Lo leído es una fecha, no doscientas filas.';

-- ------------------------------------------------------------
-- Qué cambio merece interrumpir a alguien.
--
-- Todo cambio queda en la línea de tiempo. Solo algunos suenan. Una
-- campanita que suena por todo es una campanita que se apaga.
-- ------------------------------------------------------------

create or replace function evento_avisa(p_tabla text, p_campo text)
returns boolean
language sql
immutable
as $$
  select (p_tabla, coalesce(p_campo, '')) in (
    ('proyectos', 'color'),
    ('proyectos', 'subestado'),
    ('proyectos', 'fecha_comprometida'),
    ('proyectos', 'monto_neto'),
    ('proyectos', 'etapa'),
    ('proyectos', 'responsable_id'),
    ('hitos', 'entregado_at'),
    ('hitos', 'facturado_at'),
    ('hitos', 'cobrado_at'),
    ('cobros', ''),
    ('asignaciones', ''),
    ('porciones', 'estado'),
    ('liquidaciones', '')
  )
$$;

-- El evento en castellano. La base guarda campos; la persona lee frases.
create or replace function evento_en_palabras(
  p_tabla text, p_campo text, p_accion text, p_nuevo text
)
returns text
language sql
immutable
as $$
  select case
    when p_tabla = 'cobros'         and p_accion = 'alta' then 'Entró un pago'
    when p_tabla = 'liquidaciones'  and p_accion = 'alta' then 'Se liquidó una parte'
    when p_tabla = 'asignaciones'   and p_accion = 'alta' then 'Sumaron a alguien al equipo'
    when p_tabla = 'asignaciones'   and p_accion = 'baja' then 'Sacaron a alguien del equipo'
    when p_tabla = 'hitos' and p_campo = 'entregado_at' then 'Se marcó una entrega'
    when p_tabla = 'hitos' and p_campo = 'facturado_at' then 'Se facturó una entrega'
    when p_tabla = 'hitos' and p_campo = 'cobrado_at'   then 'Se cobró una entrega'
    when p_tabla = 'porciones' and p_campo = 'estado'   then 'Cambió el estado de tu parte'
    when p_tabla = 'proyectos' and p_campo = 'color' then
      case p_nuevo
        when 'verde'    then 'Pasó a en vivo'
        when 'amarillo' then 'Volvió a seguimiento'
        when 'gris'     then 'Quedó en standby'
        when 'naranja'  then 'Se dio por terminado'
        when 'rojo'     then 'Se cerró'
        else 'Cambió de estado'
      end
    when p_tabla = 'proyectos' and p_campo = 'subestado'          then 'Cambió el detalle del estado'
    when p_tabla = 'proyectos' and p_campo = 'fecha_comprometida' then 'Cambió la fecha de entrega'
    when p_tabla = 'proyectos' and p_campo = 'monto_neto'         then 'Cambió el monto'
    when p_tabla = 'proyectos' and p_campo = 'etapa'              then 'Avanzó en el embudo'
    when p_tabla = 'proyectos' and p_campo = 'responsable_id'     then 'Cambió el responsable'
    else 'Hubo un cambio'
  end
$$;

-- ------------------------------------------------------------
-- Lo que pasó.
--
-- Hereda la RLS de `eventos`: si no lo podés ver en la ficha, tampoco
-- suena. Se excluye lo que hizo uno mismo — nadie necesita que le
-- avisen lo que acaba de hacer.
-- ------------------------------------------------------------

create or replace view v_campanita_pasado
with (security_invoker = true)
as
select
  'e' || e.id                                as clave,
  'paso'::text                               as clase,
  e.created_at                               as momento,
  evento_en_palabras(e.tabla, e.campo, e.accion, e.valor_nuevo) as titulo,
  p.nombre                                   as proyecto,
  p.codigo                                   as codigo,
  (e.afecta_persona = persona_actual())      as es_mi_plata,
  case when e.afecta_persona = persona_actual() then 'alta' else 'normal' end as urgencia
from eventos e
left join proyectos p on p.id = e.proyecto_id
where e.created_at > now() - interval '21 days'
  and evento_avisa(e.tabla, e.campo)
  and coalesce(e.actor_id, '00000000-0000-0000-0000-000000000000') <> persona_actual();

-- ------------------------------------------------------------
-- Lo que viene.
--
-- Esto no existe como evento: nadie "hace" que una fecha se venza. Son
-- estados que hay que salir a buscar, y son justamente los que hoy
-- vive Joel recordando de memoria.
-- ------------------------------------------------------------

create or replace view v_campanita_futuro
with (security_invoker = true)
as
-- Entregas que vencen o vencieron
select
  'f' || p.id                       as clave,
  'fecha'::text                     as clase,
  (p.fecha_comprometida::timestamptz) as momento,
  case
    when p.fecha_comprometida < current_date then
      'Pasó la fecha de entrega hace ' ||
      (current_date - p.fecha_comprometida) || ' días'
    when p.fecha_comprometida = current_date then 'Se entrega hoy'
    else 'Se entrega en ' || (p.fecha_comprometida - current_date) || ' días'
  end                               as titulo,
  p.nombre                          as proyecto,
  p.codigo                          as codigo,
  false                             as es_mi_plata,
  case when p.fecha_comprometida <= current_date then 'alta' else 'normal' end as urgencia
from proyectos p
where p.color = 'verde'
  and p.fecha_comprometida is not null
  and p.fecha_comprometida <= current_date + 7

union all

-- Seguimientos comerciales vencidos
select
  's' || p.id,
  'seguimiento',
  p.proximo_seguimiento,
  'Había que ' || lower(coalesce(p.proxima_accion, 'volver a hablar')),
  p.nombre,
  p.codigo,
  false,
  'alta'
from proyectos p
where p.color = 'amarillo'
  and p.proximo_seguimiento is not null
  and p.proximo_seguimiento < now()

union all

-- En vivo y sin que nadie cargue nada
select
  'q' || p.id,
  'frenado',
  now() - (v.dias_sin_novedades || ' days')::interval,
  v.dias_sin_novedades || ' días sin novedades',
  p.nombre,
  p.codigo,
  false,
  'normal'
from proyectos p
join v_pulso v on v.id = p.id
where p.color = 'verde'
  and v.dias_sin_novedades > 7

union all

-- Trabajo frenado esperando que entre el anticipo
select
  'a' || p.id,
  'anticipo',
  p.created_at,
  'No arranca hasta que entre el anticipo',
  p.nombre,
  p.codigo,
  false,
  'alta'
from proyectos p
where p.color = 'gris' and p.motivo_gris = 'esperando_anticipo';

-- ------------------------------------------------------------
-- La campanita, ya unida y ordenada.
-- ------------------------------------------------------------

create or replace view v_campanita
with (security_invoker = true)
as
select * from v_campanita_pasado
union all
select * from v_campanita_futuro;

grant select on v_campanita_pasado, v_campanita_futuro, v_campanita to authenticated;

comment on view v_campanita is
  'Derivada, nunca escrita. Lo que pasó sale de eventos; lo que viene sale del estado. Ninguna de las dos se puede olvidar de avisar.';

-- ------------------------------------------------------------
-- Marcar como leído: mover la marca, no tocar doscientas filas.
-- ------------------------------------------------------------

create or replace function marcar_leido()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into lecturas (persona_id, campanita_at)
  values (persona_actual(), now())
  on conflict (persona_id) do update set campanita_at = now();
end;
$$;

grant execute on function marcar_leido() to authenticated;
grant execute on function evento_avisa(text, text) to authenticated;
grant execute on function evento_en_palabras(text, text, text, text) to authenticated;

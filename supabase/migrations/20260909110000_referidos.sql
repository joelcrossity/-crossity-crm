-- ============================================================
-- Quién lo trajo.
--
-- La comisión al referido ya sabía calcularse: `referido` es uno de los
-- conceptos de participación desde el esquema base, así que entra sola
-- en la liquidación junto con todo lo demás. Lo que faltaba es lo de
-- antes: en la charla todavía no hay proyecto, ni monto, ni porcentaje
-- acordado, pero SÍ se sabe quién lo trajo. Y ése es justo el dato que
-- se pierde, porque cuando por fin hay plata ya nadie se acuerda.
--
-- Por eso van separados:
--   referido_por  → se anota el día uno, no compromete nada
--   participación → la acuerda administración cuando hay monto
--
-- Y una vista que no deja que el segundo paso se olvide.
-- ============================================================

alter table proyectos
  add column referido_por  uuid references personas(id) on delete set null,
  add column referido_nota text;

comment on column proyectos.referido_por is
  'Quién lo trajo. Se anota en la primera charla, cuando todavía no hay nada que repartir.';

comment on column proyectos.referido_nota is
  'Lo que se habló de la comisión antes de que exista. "Dijo que con un 10 % estaba bien."';

create index proyectos_referidos on proyectos (referido_por)
  where referido_por is not null;

-- ------------------------------------------------------------
-- Dar de alta a quien nos refiere.
--
-- Casi nunca es del equipo: es el contador de un cliente, un colega,
-- alguien que nos cruzó con quien había que cruzarnos. Entra como
-- persona externa, sin rol y sin cuenta, y aun así cobra.
-- ------------------------------------------------------------

create or replace function referente(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from personas
   where lower(nombre) = lower(trim(p_nombre)) limit 1;

  if v_id is null then
    insert into personas (nombre, es_externa, roles)
    values (trim(p_nombre), true, '{}')
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

comment on function referente is
  'Busca antes de crear: el mismo contador que nos refirió tres clientes tiene que ser una sola persona, o su comisión queda partida en tres.';

-- ------------------------------------------------------------
-- Lo que administración tiene que cerrar.
--
-- Un proyecto que se ganó, que vino por alguien, y al que nadie le
-- puso todavía el porcentaje de esa comisión. Sin esta lista, la
-- comisión se paga cuando el referido la reclama — o no se paga.
-- ------------------------------------------------------------

create or replace view v_comisiones_sin_acordar
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.nombre,
  o.nombre_canonico as cliente,
  r.nombre          as referente,
  p.referido_nota,
  p.monto_neto,
  p.moneda,
  p.color
from proyectos p
join personas r      on r.id = p.referido_por
join organizaciones o on o.id = p.organizacion_id
where p.color in ('verde', 'naranja')
  and not exists (
    select 1 from participaciones pa
     where pa.proyecto_id = p.id
       and pa.concepto = 'referido'
  );

grant select on v_comisiones_sin_acordar to authenticated;
grant execute on function referente(text) to authenticated;

comment on view v_comisiones_sin_acordar is
  'Vino por alguien, ya está en vivo, y nadie acordó cuánto se le paga. Es la lista de lo que se va a reclamar solo si nadie mira.';

-- ------------------------------------------------------------
-- Y que suene la campanita.
-- ------------------------------------------------------------

create or replace view v_campanita_futuro
with (security_invoker = true)
as
select
  'f' || p.id                       as clave,
  'fecha'::text                     as clase,
  (p.fecha_comprometida::timestamptz) as momento,
  case
    when p.fecha_comprometida < current_date then
      'Pasó la fecha de entrega hace ' || (current_date - p.fecha_comprometida) || ' días'
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

select
  's' || p.id, 'seguimiento', p.proximo_seguimiento,
  'Había que ' || lower(coalesce(p.proxima_accion, 'volver a hablar')),
  p.nombre, p.codigo, false, 'alta'
from proyectos p
where p.color = 'amarillo'
  and p.proximo_seguimiento is not null
  and p.proximo_seguimiento < now()

union all

select
  'q' || p.id, 'frenado', now() - (v.dias_sin_novedades || ' days')::interval,
  v.dias_sin_novedades || ' días sin novedades',
  p.nombre, p.codigo, false, 'normal'
from proyectos p
join v_pulso v on v.id = p.id
where p.color = 'verde' and v.dias_sin_novedades > 7

union all

select
  'a' || p.id, 'anticipo', p.created_at,
  'No arranca hasta que entre el anticipo',
  p.nombre, p.codigo, false, 'alta'
from proyectos p
where p.color = 'gris' and p.motivo_gris = 'esperando_anticipo'

union all

-- La comisión que nadie acordó
select
  'c' || c.id, 'comision', now(),
  'Vino por ' || c.referente || ' y su comisión no está acordada',
  c.nombre, c.codigo, false, 'normal'
from v_comisiones_sin_acordar c;

grant select on v_campanita_futuro to authenticated;

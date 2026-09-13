-- ------------------------------------------------------------------
-- Facturar un trabajo entre dos sociedades del mismo cliente.
--
-- El caso: "Grupo Gastronómico Sushi Paraná" factura por dos
-- sociedades, cada una con su CUIT y su responsable, y un proyecto se
-- parte mitad y mitad.
--
-- No hace falta jerarquía de clientes. razones_sociales ya es
-- exactamente eso: varias entidades legales bajo un mismo cliente, cada
-- una con su CUIT. Agregar grupo_padre_id y clientes hijos sería
-- duplicar esa estructura un nivel más arriba, y partiría en dos la
-- cuenta corriente de un cliente que es uno solo.
--
-- Lo único que faltaba es el reparto: qué porcentaje le toca a cada
-- sociedad en cada trabajo. Va por proyecto y no por cliente: el mismo
-- grupo puede repartir 50/50 un proyecto y 100/0 el siguiente.
-- ------------------------------------------------------------------

alter table razones_sociales add column if not exists responsable text;
comment on column razones_sociales.responsable is
  'Quién responde por esta sociedad del lado del cliente. No es una persona del sistema: es un nombre para saber a quién reclamarle.';

create table if not exists reparto_facturacion (
  proyecto_id      uuid not null references proyectos(id) on delete cascade,
  razon_social_id  uuid not null references razones_sociales(id) on delete cascade,
  porcentaje       numeric(6,3) not null check (porcentaje > 0 and porcentaje <= 100),
  created_at       timestamptz not null default now(),
  primary key (proyecto_id, razon_social_id)
);

comment on table reparto_facturacion is
  'Qué parte de un trabajo factura cada sociedad del cliente. Sin filas, factura la razón social principal y listo: el caso normal no necesita configurar nada.';

alter table reparto_facturacion enable row level security;

drop policy if exists reparto_fact_lectura on reparto_facturacion;
create policy reparto_fact_lectura on reparto_facturacion for select to authenticated
  using (ve_todo() or participa_en(proyecto_id));

drop policy if exists reparto_fact_escritura on reparto_facturacion;
create policy reparto_fact_escritura on reparto_facturacion for all to authenticated
  using (puede_persona('ver_facturacion') and (es_direccion() or es_admin()))
  with check (puede_persona('ver_facturacion') and (es_direccion() or es_admin()));

grant select, insert, update, delete on reparto_facturacion to authenticated;


-- Guardar un reparto entero de una vez: los porcentajes tienen que
-- sumar 100 y eso solo se puede verificar mirándolos todos juntos.
-- Fila por fila, cualquier estado intermedio no suma y habría que
-- elegir entre rechazarlo o dejar el reparto mal por un rato.
create or replace function guardar_reparto_facturacion(
  p_proyecto uuid, p_partes jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_suma numeric;
  v_org  uuid;
begin
  if not (puede_persona('ver_facturacion') and (es_direccion() or es_admin())) then
    raise exception 'No tenés permiso para tocar la facturación.';
  end if;

  select organizacion_id into v_org from proyectos where id = p_proyecto;
  if v_org is null then raise exception 'Ese proyecto no existe.'; end if;

  if p_partes is null or jsonb_array_length(p_partes) = 0 then
    delete from reparto_facturacion where proyecto_id = p_proyecto;
    return;
  end if;

  -- Todas las sociedades tienen que ser del mismo cliente: facturarle a
  -- la sociedad de otro cliente no es un reparto, es un error de carga.
  if exists (
    select 1 from jsonb_array_elements(p_partes) x
    where not exists (
      select 1 from razones_sociales r
       where r.id = (x->>'razon_social_id')::uuid and r.organizacion_id = v_org)
  ) then
    raise exception 'Alguna de esas sociedades no es de este cliente.';
  end if;

  select sum((x->>'porcentaje')::numeric) into v_suma
    from jsonb_array_elements(p_partes) x;

  if round(v_suma, 2) <> 100 then
    raise exception 'Los porcentajes suman %, tienen que sumar 100.', round(v_suma, 2);
  end if;

  delete from reparto_facturacion where proyecto_id = p_proyecto;
  insert into reparto_facturacion (proyecto_id, razon_social_id, porcentaje)
  select p_proyecto, (x->>'razon_social_id')::uuid, (x->>'porcentaje')::numeric
    from jsonb_array_elements(p_partes) x;
end;
$$;

grant execute on function guardar_reparto_facturacion(uuid, jsonb) to authenticated;


-- ------------------------------------------------------------------
-- Las órdenes de cobro: una por entrega y por sociedad.
--
-- Se derivan, no se guardan. Si fueran filas, cambiar un reparto o
-- corregir el monto de una entrega dejaría órdenes viejas conviviendo
-- con las nuevas, y habría que acordarse de regenerarlas. Derivadas,
-- siempre dicen la verdad de hoy.
--
-- Sin reparto configurado hay una sola orden, a la razón social
-- principal, por el total. El caso normal no necesita configurar nada.
-- ------------------------------------------------------------------

drop view if exists v_ordenes_cobro;
create view v_ordenes_cobro
with (security_invoker = true)
as
with partes as (
  select rf.proyecto_id, rf.razon_social_id, rf.porcentaje
    from reparto_facturacion rf
  union all
  -- Los proyectos sin reparto: todo a la principal.
  select p.id, r.id, 100
    from proyectos p
    join razones_sociales r on r.organizacion_id = p.organizacion_id and r.es_principal
   where not exists (select 1 from reparto_facturacion rf where rf.proyecto_id = p.id)
)
select
  h.id            as hito_id,
  h.proyecto_id,
  p.codigo,
  p.nombre        as proyecto,
  o.nombre_canonico as cliente,
  h.titulo        as entrega,
  h.vence_at,
  rs.id           as razon_social_id,
  rs.razon_social,
  rs.cuit,
  rs.responsable,
  pt.porcentaje,
  round(h.monto_neto * pt.porcentaje / 100, 2) as monto,
  h.moneda,
  h.facturado_at,
  h.cobrado_at,
  (select count(*) > 1 from partes x where x.proyecto_id = h.proyecto_id) as es_repartida
from hitos h
join partes pt          on pt.proyecto_id = h.proyecto_id
join razones_sociales rs on rs.id = pt.razon_social_id
join proyectos p        on p.id = h.proyecto_id
join organizaciones o   on o.id = p.organizacion_id;

grant select on v_ordenes_cobro to authenticated;

comment on view v_ordenes_cobro is
  'Qué le corresponde facturar a cada sociedad por cada entrega. Derivadas del reparto: cambiar el reparto las actualiza solas, sin regenerar nada.';

-- Un cobro puede venir de una sociedad puntual del cliente.
alter table cobros add column if not exists razon_social_id uuid references razones_sociales(id);
comment on column cobros.razon_social_id is
  'Qué sociedad del cliente pagó. Vacío cuando factura una sola y no hace falta distinguir.';

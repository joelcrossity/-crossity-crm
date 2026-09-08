-- ============================================================
-- La cuenta corriente de cada cliente.
--
-- Como en SUINO, pero con una diferencia que importa: allá el saldo se
-- arma de comprobantes; acá se arma de hechos que el sistema ya
-- registra —se facturó, se cobró—. No hay que cargar nada nuevo.
--
-- El saldo es lo facturado menos lo cobrado. Y aparte, lo entregado y
-- todavía no facturado, que no es deuda del cliente todavía pero es
-- plata que le vamos a reclamar: verlas separadas evita las dos
-- confusiones típicas, reclamar lo que no se facturó y olvidar lo que
-- se entregó.
-- ============================================================

create or replace view v_cuenta_corriente
with (security_invoker = true)
as
select
  o.id            as organizacion_id,
  o.codigo        as cliente_codigo,
  o.nombre_canonico as cliente,
  h.moneda,

  coalesce(sum(h.monto_neto) filter (where h.facturado_at is not null), 0)  as facturado,
  coalesce(sum(h.monto_neto) filter (where h.cobrado_at is not null), 0)    as cobrado,
  coalesce(sum(h.monto_neto) filter (
    where h.facturado_at is not null and h.cobrado_at is null), 0)          as debe,
  coalesce(sum(h.monto_neto) filter (
    where h.entregado_at is not null and h.facturado_at is null), 0)        as sin_facturar,

  -- Lo más viejo sin cobrar: una deuda de sesenta días no es lo mismo
  -- que una de cinco, aunque el monto sea igual.
  max(current_date - h.facturado_at::date) filter (
    where h.facturado_at is not null and h.cobrado_at is null)              as dias_del_mas_viejo
from organizaciones o
join proyectos p on p.organizacion_id = o.id
join hitos h     on h.proyecto_id = p.id
group by o.id, o.codigo, o.nombre_canonico, h.moneda
having coalesce(sum(h.monto_neto), 0) > 0;

grant select on v_cuenta_corriente to authenticated;

comment on view v_cuenta_corriente is
  'Se arma de hechos ya registrados, no de comprobantes cargados aparte. Lo facturado sin cobrar es deuda; lo entregado sin facturar todavía no, pero se va a reclamar.';

-- El movimiento detrás del saldo: qué pasó y cuándo.
create or replace view v_movimientos
with (security_invoker = true)
as
select
  'f' || h.id       as clave,
  p.organizacion_id,
  h.facturado_at::date as fecha,
  'factura'::text   as clase,
  'Se facturó ' || h.titulo as detalle,
  h.monto_neto      as debe,
  0::numeric        as haber,
  h.moneda,
  p.codigo          as proyecto_codigo,
  p.nombre          as proyecto
from hitos h join proyectos p on p.id = h.proyecto_id
where h.facturado_at is not null

union all

select
  'c' || c.id,
  p.organizacion_id,
  c.fecha,
  'cobro',
  'Entró ' || coalesce(c.medio, 'un pago'),
  0::numeric,
  c.monto,
  h.moneda,
  p.codigo,
  p.nombre
from cobros c
join hitos h     on h.id = c.hito_id
join proyectos p on p.id = h.proyecto_id;

grant select on v_movimientos to authenticated;

comment on view v_movimientos is
  'Debe y haber, con su origen. Sin el detalle, un saldo que no cierra no se puede discutir con nadie.';

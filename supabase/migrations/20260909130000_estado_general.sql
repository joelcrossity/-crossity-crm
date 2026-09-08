-- ============================================================
-- El pulso de la empresa, en una línea.
--
-- Tomado de cómo lo resuelve SUINO-360: una franja fija arriba con
-- cuatro señales del estado del sistema, visible en TODAS las pantallas.
-- Su valor no está en el dato —que también está en Hoy— sino en que no
-- hay que ir a buscarlo: se ve estés donde estés.
--
-- Una sola vista, una sola consulta. La franja se pinta en cada
-- pantalla y no puede costar cuatro viajes a la base.
-- ============================================================

create or replace view v_estado_general
with (security_invoker = true)
as
select
  (select count(*) from proyectos where color = 'verde' and tipo = 'proyecto')  as en_vivo,

  (select count(*) from proyectos p
    where p.color = 'verde'
      and p.fecha_comprometida is not null
      and p.fecha_comprometida < current_date)                                  as atrasados,

  (select count(*) from proyectos p
     join v_pulso v on v.id = p.id
    where p.color = 'verde' and v.dias_sin_novedades > 7)                       as frenados,

  (select count(*) from proyectos
    where color = 'amarillo' and etapa is not null and etapa <> 'ganado')       as en_pipeline,

  (select count(*) from proyectos
    where color = 'amarillo'
      and proximo_seguimiento is not null
      and proximo_seguimiento < now())                                          as seguimientos_vencidos,

  -- Facturado y todavía sin entrar. Solo pesos: mezclar monedas en una
  -- franja de una línea miente más de lo que informa.
  (select coalesce(sum(monto_neto), 0) from hitos
    where moneda = 'ARS' and facturado_at is not null and cobrado_at is null)   as por_cobrar,

  (select count(*) from proyectos where tipo = 'mantenimiento' and color = 'verde') as abonos;

grant select on v_estado_general to authenticated;

comment on view v_estado_general is
  'La franja de arriba. Su valor no es el dato sino que no haya que ir a buscarlo.';

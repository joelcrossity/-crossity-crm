-- ------------------------------------------------------------------
-- El saldo de cada caja, calculado.
--
-- Lo que había antes del sistema (saldo_inicial), más lo que entró por
-- cobros, menos lo que salió por pagos a la gente. Nada de esto se
-- guarda sumado: se cuenta cada vez. Con 45 proyectos eso es
-- instantáneo, y a cambio no existe la posibilidad de que el saldo y
-- los movimientos digan cosas distintas.
--
-- Y el mismo saldo valuado en la otra moneda, para el selector de
-- ARS/USD: una caja en dólares mirada en pesos vale según el dólar del
-- día, y cuál dólar lo decide quien mira, no la caja.
-- ------------------------------------------------------------------

create or replace function equivale_en(
  p_monto numeric, p_de char(3), p_a char(3),
  p_casa text default 'oficial', p_fecha date default current_date
) returns numeric
language sql stable
as $$
  select case
    when p_monto is null then null
    when p_de = p_a then p_monto
    -- De dólares a pesos: se multiplica por la cotización.
    when p_de = 'USD' and p_a = 'ARS' then
      round(p_monto * coalesce(cotizacion_de('USD', p_casa, p_fecha), 0), 2)
    -- De pesos a dólares: se divide. Sin cotización no se inventa un
    -- número: se devuelve null y la pantalla dice que falta cargarla.
    when p_de = 'ARS' and p_a = 'USD' then
      case when coalesce(cotizacion_de('USD', p_casa, p_fecha), 0) > 0
           then round(p_monto / cotizacion_de('USD', p_casa, p_fecha), 2) end
  end;
$$;

grant execute on function equivale_en(numeric, char, char, text, date) to authenticated;


drop view if exists v_cajas;
create view v_cajas
with (security_invoker = true)
as
select
  c.id, c.nombre, c.moneda, c.activa, c.orden, c.notas, c.desde,
  c.saldo_inicial,
  coalesce((select sum(co.monto) from cobros co where co.caja_id = c.id), 0)          as entro,
  coalesce((select sum(po.monto_pagado) from porciones po where po.caja_id = c.id), 0) as salio,
  c.saldo_inicial
    + coalesce((select sum(co.monto) from cobros co where co.caja_id = c.id), 0)
    - coalesce((select sum(po.monto_pagado) from porciones po where po.caja_id = c.id), 0)
                                                                                      as saldo,
  -- El mismo saldo en la otra moneda, a los dos dólares.
  equivale_en(
    c.saldo_inicial
      + coalesce((select sum(co.monto) from cobros co where co.caja_id = c.id), 0)
      - coalesce((select sum(po.monto_pagado) from porciones po where po.caja_id = c.id), 0),
    c.moneda, case when c.moneda = 'ARS' then 'USD' else 'ARS' end, 'oficial')        as saldo_otra_oficial,
  equivale_en(
    c.saldo_inicial
      + coalesce((select sum(co.monto) from cobros co where co.caja_id = c.id), 0)
      - coalesce((select sum(po.monto_pagado) from porciones po where po.caja_id = c.id), 0),
    c.moneda, case when c.moneda = 'ARS' then 'USD' else 'ARS' end, 'blue')           as saldo_otra_blue
from cajas c;

grant select on v_cajas to authenticated;


-- Las cotizaciones del día, para el widget de la cabecera.
drop view if exists v_cotizacion_hoy;
create view v_cotizacion_hoy as
select casa, valor as venta, compra, fecha, fuente,
       (fecha < current_date) as desactualizada
from cotizaciones c
where moneda = 'USD'
  and fecha = (select max(f.fecha) from cotizaciones f where f.moneda = 'USD' and f.casa = c.casa)
  and casa in ('oficial', 'blue');

grant select on v_cotizacion_hoy to authenticated;

comment on view v_cotizacion_hoy is
  'Las dos cotizaciones que se miran, con la marca de si son de hoy. Sin la marca, una cotización vieja se lee como la del día y se cotiza mal.';

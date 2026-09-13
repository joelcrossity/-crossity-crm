-- ------------------------------------------------------------------
-- La planilla del mes.
--
-- Ya existían costos_fijos —alquiler, licencias, lo que se repite— pero
-- está vacía y no alcanza: un gasto puntual, la factura de Meta de
-- septiembre o una retención bancaria no son costos fijos y no tienen
-- dónde anotarse.
--
-- gastos es lo que salió, una fila por vez que salió. Los fijos siguen
-- siendo la plantilla de lo que se repite; los gastos son los hechos.
-- Separarlos importa: "el alquiler son 800.000 por mes" y "en agosto
-- pagué 800.000 de alquiler" son dos cosas distintas, y mezclarlas hace
-- que no se pueda comparar lo previsto con lo que realmente pasó.
--
-- Un gasto puede colgar de un proyecto o no. Los que cuelgan son los
-- que se reparten antes de dividir —ya existe ese circuito— y los que
-- no son de la agencia entera.
-- ------------------------------------------------------------------

-- gastos ya existía, pero solo para gastos DE UN PROYECTO: los que se
-- descuentan antes de repartir, con su IVA. proyecto_id es obligatorio,
-- así que el alquiler de la oficina no tiene dónde anotarse.
--
-- Se abre esa tabla en vez de crear una segunda. Un gasto es un gasto:
-- algunos cuelgan de un proyecto y otros son de la agencia entera, y
-- eso ya lo dice proyecto_id estando o no estando. Dos tablas serían
-- dos lugares donde buscar "qué salió este mes", y la respuesta sería
-- la suma de las dos, que es justo lo que nadie se acuerda de hacer.

alter table gastos alter column proyecto_id drop not null;
alter table gastos add column if not exists categoria text not null default 'otros';
alter table gastos add column if not exists costo_fijo_id uuid references costos_fijos(id) on delete set null;
alter table gastos add column if not exists caja_id uuid references cajas(id);
alter table gastos add column if not exists comprobante text;
alter table gastos add column if not exists cargado_por uuid references personas(id);

comment on table gastos is
  'Lo que salió, una fila por vez que salió. Con proyecto_id es un costo del proyecto y se descuenta antes de repartir; sin él es de la agencia. costos_fijos es la plantilla de lo que se repite; esto son los hechos.';
comment on column gastos.costo_fijo_id is
  'De qué gasto fijo salió, cuando se generó a partir de uno. Sirve para saber qué fijo del mes todavía no se pagó.';

create index if not exists gastos_por_fecha on gastos (fecha desc);

alter table gastos enable row level security;

drop policy if exists gastos_lectura on gastos;
create policy gastos_lectura on gastos for select to authenticated
  using (puede_persona('ver_economia'));

drop policy if exists gastos_escritura on gastos;
create policy gastos_escritura on gastos for all to authenticated
  using (puede_persona('ver_economia') and (es_direccion() or es_admin()))
  with check (puede_persona('ver_economia') and (es_direccion() or es_admin()));

grant select, insert, update, delete on gastos to authenticated;


-- ------------------------------------------------------------------
-- La planilla: un mes, en pesos.
--
-- Todo se valúa a una sola moneda para poder sumarlo. Se elige el dólar
-- con el que se mira, porque el resultado del mes en pesos cambia según
-- cuál se use y eso es una decisión, no un detalle técnico.
--
-- Lo real y lo previsto van separados y no sumados: un ingreso previsto
-- es una entrega con fecha en el mes que todavía no se cobró, y meterlo
-- en la misma fila que lo que entró de verdad es cómo uno se convence
-- de que tiene plata que no tiene.
-- ------------------------------------------------------------------

create or replace function planilla_mes(p_mes date, p_casa text default 'oficial')
returns table (
  seccion text, fila text, detalle text, monto numeric, es_previsto boolean
)
language sql stable
security invoker
as $$
  with rango as (
    select date_trunc('month', p_mes)::date as desde,
           (date_trunc('month', p_mes) + interval '1 month - 1 day')::date as hasta
  )
  -- ENTRÓ: cobros del mes.
  select 'Ingresos', 'Cobrado de clientes',
         count(*)::text || ' cobro' || case when count(*) = 1 then '' else 's' end,
         coalesce(sum(equivale_en(co.monto, co.moneda, 'ARS', p_casa, co.fecha)), 0),
         false
    from cobros co, rango r
   where co.fecha between r.desde and r.hasta

  union all
  -- POR ENTRAR: entregas con fecha en el mes, facturadas o no, sin cobrar.
  select 'Ingresos', 'Previsto de proyectos',
         count(*)::text || ' entrega' || case when count(*) = 1 then '' else 's' end
           || ' con fecha en el mes',
         coalesce(sum(equivale_en(h.monto_neto, h.moneda, 'ARS', p_casa, r.hasta)), 0),
         true
    from hitos h
    join proyectos p on p.id = h.proyecto_id, rango r
   where h.cobrado_at is null
     and h.vence_at between r.desde and r.hasta
     and p.archivado_at is null

  union all
  -- POR ENTRAR: abonos vigentes que todavía no se cobraron este mes.
  select 'Ingresos', 'Previsto de abonos',
         count(*)::text || ' abono' || case when count(*) = 1 then '' else 's' end || ' vigentes',
         coalesce(sum(equivale_en(p.monto_mensual, p.moneda, 'ARS', p_casa, r.hasta)), 0),
         true
    from proyectos p, rango r
   where p.tipo = 'mantenimiento' and p.color = 'verde' and p.archivado_at is null
     and (p.vigencia_hasta is null or p.vigencia_hasta >= r.desde)

  union all
  -- SALIÓ: los gastos del mes, agrupados.
  select 'Egresos', initcap(g.categoria),
         count(*)::text || ' gasto' || case when count(*) = 1 then '' else 's' end,
         coalesce(sum(equivale_en(coalesce(g.costo_real, g.neto), g.moneda, 'ARS', p_casa, g.fecha)), 0),
         false
    from gastos g, rango r
   where g.fecha between r.desde and r.hasta
   group by g.categoria

  union all
  -- POR SALIR: los fijos vigentes que este mes no tienen gasto cargado.
  select 'Egresos', 'Fijos sin pagar',
         count(*)::text || ' pendiente' || case when count(*) = 1 then '' else 's' end,
         coalesce(sum(equivale_en(cf.monto, cf.moneda, 'ARS', p_casa, r.hasta)), 0),
         true
    from costos_fijos cf, rango r
   where cf.desde <= r.hasta and (cf.hasta is null or cf.hasta >= r.desde)
     and not exists (select 1 from gastos g
                      where g.costo_fijo_id = cf.id
                        and g.fecha between r.desde and r.hasta)

  union all
  -- POR SALIR: lo que se le debe a la gente por trabajo ya cobrado.
  select 'Egresos', 'A liquidar al equipo',
         count(*)::text || ' pendiente' || case when count(*) = 1 then '' else 's' end,
         coalesce(sum(equivale_en(po.monto, po.moneda, 'ARS', p_casa, r.hasta)), 0),
         true
    from porciones po, rango r
   where po.estado = 'a_liquidar';
$$;

grant execute on function planilla_mes(date, text) to authenticated;

comment on function planilla_mes is
  'Un mes valuado en pesos. Lo real y lo previsto van en filas separadas: sumarlos es como uno se convence de que tiene plata que no tiene.';

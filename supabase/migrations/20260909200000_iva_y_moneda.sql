-- ============================================================
-- El IVA no siempre aplica, y la moneda no siempre es el peso.
--
-- Dos cosas que la base sabía a medias y la pantalla no sabía nada.
--
-- El IVA vivía en `contratos`, que la app nunca toca. Y la costumbre de
-- la casa es cotizar "X más IVA", así que el sistema lo daba por
-- supuesto. Pero hay proyectos que no lo llevan —un servicio al
-- exterior, un cliente exento— y darlo por supuesto ahí no es un
-- redondeo: es cobrar de más o de menos.
--
-- Va en el proyecto y no en el contrato porque es donde se decide, y
-- porque muchos proyectos nunca llegan a tener contrato cargado.
-- ============================================================

alter table proyectos
  add column alicuota_iva numeric(6,3) not null default 21,
  add column nota_iva     text;

alter table proyectos
  add constraint alicuota_conocida check (alicuota_iva in (0, 10.5, 21, 27));

comment on column proyectos.alicuota_iva is
  'Cero es una respuesta válida y frecuente: exportación de servicios, cliente exento. No es "sin cargar".';

comment on column proyectos.nota_iva is
  'Por qué no lleva IVA. Dentro de un año nadie se acuerda, y es lo primero que pregunta el contador.';

-- El monto guardado siempre es NETO. El IVA se calcula, no se guarda:
-- guardarlo es garantizar que algún día no coincidan.
create or replace view v_proyecto_plata
with (security_invoker = true)
as
select
  p.id,
  p.codigo,
  p.monto_neto,
  p.moneda,
  p.alicuota_iva,
  round(coalesce(p.monto_neto, 0) * p.alicuota_iva / 100, 2) as iva,
  round(coalesce(p.monto_neto, 0) * (1 + p.alicuota_iva / 100), 2) as total_con_iva,
  cotizacion_a(p.moneda, current_date) as cotizacion,
  round(coalesce(p.monto_neto, 0) * cotizacion_a(p.moneda, current_date), 2) as neto_en_pesos
from proyectos p;

grant select on v_proyecto_plata to authenticated;

comment on view v_proyecto_plata is
  'El neto es lo guardado; el IVA y el total se derivan. Guardar los tres es garantizar que algún día no coincidan.';

-- ------------------------------------------------------------
-- Cargar la cotización del día.
--
-- Sin esto, un proyecto en dólares no se puede sumar con uno en pesos y
-- los totales de la empresa mienten por omisión: hoy directamente se
-- saltean las otras monedas.
-- ------------------------------------------------------------

create or replace function anotar_cotizacion(
  p_moneda char(3),
  p_valor  numeric,
  p_fecha  date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (es_direccion() or es_admin()) then
    raise exception 'Solo dirección o administración cargan cotizaciones';
  end if;

  if p_valor <= 0 then
    raise exception 'La cotización tiene que ser mayor a cero';
  end if;

  insert into cotizaciones (moneda, fecha, valor, fuente)
  values (p_moneda, p_fecha, p_valor, 'carga manual')
  on conflict (moneda, fecha) do update set valor = excluded.valor, fuente = 'carga manual';
end;
$$;

grant execute on function anotar_cotizacion(char, numeric, date) to authenticated;

-- La última cotización conocida de cada moneda, para mostrarla.
create or replace view v_cotizaciones
with (security_invoker = true)
as
select distinct on (m.codigo)
  m.codigo,
  m.nombre,
  m.simbolo,
  c.valor,
  c.fecha,
  (current_date - c.fecha) as dias_de_atraso
from monedas m
left join cotizaciones c on c.moneda = m.codigo
where m.activa
order by m.codigo, c.fecha desc nulls last;

grant select on v_cotizaciones to authenticated;

comment on view v_cotizaciones is
  'dias_de_atraso es la señal que importa: una cotización de hace tres semanas convierte mal y nadie se entera.';

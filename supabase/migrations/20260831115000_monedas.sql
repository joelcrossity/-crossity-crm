-- ============================================================
-- Monedas.
--
-- Catálogo y no lista fija: sumar una moneda tiene que ser una fila,
-- no una migración. Arrancan peso, dólar y euro.
-- ============================================================

create table monedas (
  codigo     char(3) primary key,          -- ISO 4217
  nombre     text not null,
  simbolo    text not null,
  decimales  smallint not null default 2,
  activa     boolean not null default true
);

insert into monedas (codigo, nombre, simbolo) values
  ('ARS', 'Peso argentino', '$'),
  ('USD', 'Dólar estadounidense', 'US$'),
  ('EUR', 'Euro', '€');

-- ------------------------------------------------------------
-- Cotizaciones. Una por moneda y fecha, contra el peso.
-- Guardamos la serie y no un valor suelto porque lo que importa
-- es a cuánto estaba el día que pasó cada cosa, no hoy.
-- ------------------------------------------------------------

create table cotizaciones (
  id      bigint generated always as identity primary key,
  moneda  char(3) not null references monedas(codigo),
  fecha   date not null,
  valor   numeric(14,4) not null,          -- cuántos ARS vale 1 unidad
  fuente  text,
  constraint valor_positivo check (valor > 0)
);

create unique index cotizaciones_unicas on cotizaciones (moneda, fecha);

insert into cotizaciones (moneda, fecha, valor, fuente) values
  ('ARS', current_date, 1, 'base');

-- La cotización vigente a una fecha: la última cargada hasta ese día.
create or replace function cotizacion_a(p_moneda char(3), p_fecha date default current_date)
returns numeric
language sql
stable
as $$
  select coalesce(
    (select c.valor from cotizaciones c
      where c.moneda = p_moneda and c.fecha <= p_fecha
      order by c.fecha desc limit 1),
    case when p_moneda = 'ARS' then 1 else null end
  )
$$;

comment on function cotizacion_a is
  'Devuelve null si no hay cotización cargada: es preferible que falte a que invente un número.';

alter table monedas enable row level security;
alter table cotizaciones enable row level security;

create policy monedas_lectura on monedas for select to authenticated using (true);

create policy cotizaciones_lectura on cotizaciones for select to authenticated using (true);
create policy cotizaciones_escritura on cotizaciones for all to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());

grant select on monedas to authenticated;
grant select, insert, update on cotizaciones to authenticated;
grant usage, select on sequence cotizaciones_id_seq to authenticated;

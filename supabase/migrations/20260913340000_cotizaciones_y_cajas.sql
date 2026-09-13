-- ------------------------------------------------------------------
-- 1. Las cotizaciones: oficial y blue, no una sola.
--
-- cotizaciones ya existía pero guardaba un valor por moneda y fecha,
-- sin distinguir de qué dólar se habla. Acá esa distinción no es un
-- detalle: un abono de 290 dólares vale 443.700 al oficial y 448.050 al
-- blue, y cuál de los dos se usa es lo que se pactó con el cliente.
--
-- Se extiende en vez de crear una tabla nueva: el dato es el mismo y
-- dos tablas de cotizaciones serían dos lugares para el mismo número.
-- valor sigue siendo la venta, que es a la que se compra.
-- ------------------------------------------------------------------

alter table cotizaciones add column if not exists casa text not null default 'oficial';
alter table cotizaciones add column if not exists compra numeric(14,4);

alter table cotizaciones drop constraint if exists casa_conocida;
alter table cotizaciones add constraint casa_conocida
  check (casa in ('oficial', 'blue', 'bolsa', 'tarjeta', 'pactado'));

create unique index if not exists cotizaciones_unica
  on cotizaciones (moneda, casa, fecha);

comment on column cotizaciones.valor is 'La venta: a la que se compra la divisa.';
comment on column cotizaciones.casa is 'oficial, blue, bolsa, tarjeta. "pactado" es el que se fijó con un cliente y no sale de ninguna API.';

-- La cotización que vale para una fecha: la de ese día, o la última
-- anterior. Un feriado no tiene cotización propia y no por eso se deja
-- de poder valuar algo cargado ese día.
create or replace function cotizacion_de(
  p_moneda char(3), p_casa text default 'oficial', p_fecha date default current_date
) returns numeric
language sql stable
as $$
  select c.valor from cotizaciones c
   where c.moneda = p_moneda and c.casa = p_casa and c.fecha <= p_fecha
   order by c.fecha desc limit 1;
$$;

grant execute on function cotizacion_de(char, text, date) to authenticated;

-- Guardar lo que trae la API. Definer porque lo llama un proceso
-- automático sin persona detrás.
create or replace function guardar_cotizacion(
  p_moneda char(3), p_casa text, p_venta numeric, p_compra numeric default null,
  p_fecha date default current_date, p_fuente text default 'dolarapi'
) returns void
language sql security definer set search_path = public
as $$
  insert into cotizaciones (moneda, casa, fecha, valor, compra, fuente)
  values (p_moneda, p_casa, p_fecha, p_venta, p_compra, p_fuente)
  on conflict (moneda, casa, fecha) do update
    set valor = excluded.valor, compra = excluded.compra, fuente = excluded.fuente;
$$;

grant execute on function guardar_cotizacion(char, text, numeric, numeric, date, text) to authenticated;


-- ------------------------------------------------------------------
-- 2. Qué dólar usa cada trabajo.
-- ------------------------------------------------------------------

alter table proyectos add column if not exists casa_cotizacion text not null default 'oficial';
alter table proyectos add column if not exists cotizacion_pactada numeric(14,4);

alter table proyectos drop constraint if exists casa_del_proyecto;
alter table proyectos add constraint casa_del_proyecto check (
  casa_cotizacion in ('oficial','blue','bolsa','tarjeta','pactado')
  and (casa_cotizacion <> 'pactado' or cotizacion_pactada > 0)
);

comment on column proyectos.casa_cotizacion is
  'A qué dólar se convierte cuando el trabajo está en USD. "pactado" usa cotizacion_pactada y no se mueve.';


-- ------------------------------------------------------------------
-- 3. Las cajas.
--
-- Una caja es dónde está la plata, no un segundo libro de la plata. Lo
-- que entra ya se registra en cobros y lo que sale en porciones; si
-- además hubiera una tabla de movimientos de caja, el mismo cobro
-- estaría anotado dos veces y tarde o temprano una de las dos quedaría
-- mal.
--
-- Entonces la caja no acumula un saldo: se le cuelgan los cobros y los
-- pagos que ya existen, y el saldo se calcula. Un saldo guardado es un
-- número que hay que acordarse de actualizar en cada camino que mueve
-- plata, y alcanza con olvidarse de uno para que no cierre nunca más.
--
-- El saldo inicial sí se guarda: es lo que había antes de que el
-- sistema existiera, y eso no se puede derivar de nada.
-- ------------------------------------------------------------------

create table if not exists cajas (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  moneda        char(3) not null references monedas(codigo),
  saldo_inicial numeric(14,2) not null default 0,
  desde         date not null default current_date,
  notas         text,
  activa        boolean not null default true,
  orden         integer not null default 0,
  created_at    timestamptz not null default now()
);

comment on table cajas is
  'Dónde está la plata. No lleva saldo: se calcula con los cobros y pagos que ya se registran en otro lado. Un saldo guardado es un número que hay que acordarse de actualizar en cada camino.';

alter table cobros    add column if not exists caja_id uuid references cajas(id);
alter table porciones add column if not exists caja_id uuid references cajas(id);

comment on column cobros.caja_id is 'En qué caja entró. Vacío en lo cargado antes de que existieran las cajas.';

alter table cajas enable row level security;

drop policy if exists cajas_lectura on cajas;
create policy cajas_lectura on cajas for select to authenticated
  using (puede_persona('ver_facturacion'));

drop policy if exists cajas_escritura on cajas;
create policy cajas_escritura on cajas for all to authenticated
  using (es_direccion() or es_admin()) with check (es_direccion() or es_admin());

grant select on cajas to authenticated;
grant insert, update, delete on cajas to authenticated;

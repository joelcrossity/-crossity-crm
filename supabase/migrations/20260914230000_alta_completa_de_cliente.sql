-- ------------------------------------------------------------------
-- Dar de alta un cliente completo, y poder completarlo después.
--
-- Un vendedor podía crear la organización y nada más: la razón social y
-- la marca pedían editar_clientes, que solo tenían dirección y
-- administración. Y el alta ignora el error de esos dos inserts, así
-- que el cliente quedaba sin razón social, sin CUIT y sin marca, en
-- silencio. Sin razón social no hay a quién facturarle.
--
-- Y había un agujero al revés: las políticas de edición eran solo
-- puede_persona('editar_clientes'), sin alcance por fila. Quien tuviera
-- el permiso podía modificar cualquier cliente, incluso uno que no
-- puede ver. Lo escribí así cuando el permiso lo tenían dos personas de
-- confianza, y eso no es una regla: es una apuesta.
--
-- Ahora editar un cliente pide el permiso Y que sea de uno: que
-- participes en algún proyecto suyo, o que lo hayas dado de alta vos.
-- Lo segundo hace falta por el huevo y la gallina: recién creado
-- todavía no tiene proyectos, y sin eso el que lo crea no podría
-- terminar de cargarlo.
-- ------------------------------------------------------------------

alter table organizaciones add column if not exists creada_por uuid references personas(id);

comment on column organizaciones.creada_por is
  'Quién lo dio de alta. Sirve para que pueda terminar de cargarlo antes de que tenga proyectos: sin esto, el que crea un cliente no puede ponerle el CUIT.';


create or replace function cliente_mio(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select ve_todo()
      or exists (select 1 from organizaciones o
                  where o.id = p_org and o.creada_por = persona_actual())
      or exists (select 1 from proyectos p
                  where p.organizacion_id = p_org
                    and (p.responsable_id = persona_actual()
                      or exists (select 1 from asignaciones a
                                  where a.proyecto_id = p.id
                                    and a.persona_id = persona_actual() and a.hasta is null)
                      or exists (select 1 from participaciones pa
                                  where pa.proyecto_id = p.id
                                    and pa.persona_id = persona_actual())));
$$;

grant execute on function cliente_mio(uuid) to authenticated;

comment on function cliente_mio is
  'Si este cliente es de esta persona: participa en algún proyecto suyo, o lo dio de alta. Dirección y administración ven todos.';


-- ------------------------------------------------------------------
-- El alta completa, en una sola operación.
--
-- Crea la organización con su razón social y su marca. Va junto porque
-- es una sola cosa: un cliente sin razón social no se puede facturar, y
-- dejarlo a medias es peor que no crearlo, porque parece que está.
-- ------------------------------------------------------------------

create or replace function alta_de_cliente(
  p_nombre text,
  p_cuit   text default null,
  p_alias  text[] default '{}'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_limpio text;
  v_duenio text;
begin
  if not carga_trabajo() then
    raise exception 'No tenés permiso para dar de alta clientes.';
  end if;
  if trim(coalesce(p_nombre, '')) = '' then
    raise exception 'El cliente necesita un nombre.';
  end if;

  v_limpio := nullif(regexp_replace(coalesce(p_cuit, ''), '[^0-9]', '', 'g'), '');
  if v_limpio is not null then
    select nombre into v_duenio from cliente_con_cuit(v_limpio) limit 1;
    if v_duenio is not null then
      raise exception 'Ese CUIT ya es de %.', v_duenio;
    end if;
  end if;

  insert into organizaciones (nombre_canonico, alias, cuit, creada_por)
  values (trim(p_nombre), coalesce(p_alias, '{}'), nullif(trim(coalesce(p_cuit,'')), ''), persona_actual())
  returning id into v_id;

  -- Toda cuenta arranca con una razón social y una marca con su mismo
  -- nombre. Las que facturan por varias se agregan después.
  insert into razones_sociales (organizacion_id, razon_social, cuit, es_principal)
  values (v_id, trim(p_nombre), nullif(trim(coalesce(p_cuit,'')), ''), true);

  insert into marcas (organizacion_id, nombre, es_principal)
  values (v_id, trim(p_nombre), true);

  return v_id;
end;
$$;

grant execute on function alta_de_cliente(text, text, text[]) to authenticated;


-- ------------------------------------------------------------------
-- Editar: el permiso, y que sea de uno.
-- ------------------------------------------------------------------

insert into roles_permisos (rol, accion) values
  ('vendedor', 'editar_clientes'),
  ('project_manager', 'editar_clientes')
on conflict do nothing;

drop policy if exists organizaciones_escritura_cambio on organizaciones;
create policy organizaciones_escritura_cambio on organizaciones
  for update to authenticated
  using (puede_persona('editar_clientes') and cliente_mio(id))
  with check (puede_persona('editar_clientes') and cliente_mio(id));

do $$
declare t text;
begin
  foreach t in array array['razones_sociales','marcas','contactos'] loop
    execute format('drop policy if exists %I on %I', t||'_alta_propia', t);
    execute format($f$create policy %I on %I for insert to authenticated
                      with check (puede_persona('editar_clientes') and cliente_mio(organizacion_id))$f$,
                   t||'_alta_propia', t);

    execute format('drop policy if exists %I on %I', t||'_cambio_propio', t);
    execute format($f$create policy %I on %I for update to authenticated
                      using (puede_persona('editar_clientes') and cliente_mio(organizacion_id))
                      with check (puede_persona('editar_clientes') and cliente_mio(organizacion_id))$f$,
                   t||'_cambio_propio', t);

    execute format('drop policy if exists %I on %I', t||'_baja_propia', t);
    execute format($f$create policy %I on %I for delete to authenticated
                      using (puede_persona('editar_clientes') and cliente_mio(organizacion_id))$f$,
                   t||'_baja_propia', t);
  end loop;
end $$;

-- Las viejas, sin alcance por fila, se van.
drop policy if exists razones_alta on razones_sociales;
drop policy if exists razones_cambio on razones_sociales;
drop policy if exists razones_baja on razones_sociales;
drop policy if exists contactos_escritura_alta on contactos;
drop policy if exists contactos_escritura_cambio on contactos;
drop policy if exists contactos_escritura_baja on contactos;
drop policy if exists marcas_escritura_alta on marcas;
drop policy if exists marcas_escritura_cambio on marcas;
drop policy if exists marcas_escritura_baja on marcas;

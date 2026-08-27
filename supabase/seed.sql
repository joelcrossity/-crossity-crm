-- ============================================================
-- Seed: el padrón y las 37 filas de las dos hojas maestras.
-- La clasificación de color es la propuesta del documento de alcance;
-- se corrige adentro del sistema, no acá.
-- ============================================================

-- ------------------------------------------------------------
-- Personas
-- ------------------------------------------------------------

insert into personas (id, nombre, email, roles) values
  ('11111111-1111-1111-1111-000000000001', 'Joel Lifschitz',    'joel@crossity.ar',   '{direccion}'),
  ('11111111-1111-1111-1111-000000000002', 'Claudio Gervasoni', null,                 '{desarrollo}'),
  ('11111111-1111-1111-1111-000000000003', 'Santiago Díaz',     null,                 '{desarrollo}'),
  ('11111111-1111-1111-1111-000000000004', 'Germán Gatti',      'german@crossity.ar', '{project_manager,vendedor}'),
  ('11111111-1111-1111-1111-000000000005', 'Triana Lifschitz',  null,                 '{administracion}'),
  ('11111111-1111-1111-1111-000000000006', 'Tomás Laurie',      'tomas@crossity.ar',  '{}');

comment on table personas is 'El rol de Tomás Laurie quedó pendiente de definir.';

-- ------------------------------------------------------------
-- Clientes. Los alias salen de cómo aparece escrito cada uno
-- en las planillas: son lo que evita que se dupliquen.
-- ------------------------------------------------------------

insert into organizaciones (nombre_canonico, alias) values
  ('SUINO',                          '{}'),
  ('COTEF',                          '{"COTEF- Frigorifico","COTEF Frigorífico"}'),
  ('MULTIDEPOT',                     '{"MULTI DESPOT","Multi Depot"}'),
  ('Stilo Amoblamientos',            '{"STILO AMOBALMIENTOS","Stilo Amablamiento"}'),
  ('Vision Motors',                  '{"Vision motor","VISION MOTORS","Visión Motors"}'),
  ('Rodados Integrales',             '{}'),
  ('Remolques INDECAR',              '{"INDECAR"}'),
  ('Estudio Contable Pepo Rodríguez','{"Sistema Estudio contable pepo","Pepo"}'),
  ('Geriátrico / Franquicia',        '{"Geriattrico","Geronto"}'),
  ('Paraná Come',                    '{"PARANA COME"}'),
  ('VDOCS',                          '{"Porducto VDOCS","Producto VDOCS"}'),
  ('Transporte Marcelito',           '{"TRANSPORTE MARCELITO"}'),
  ('GEXPLO',                         '{"GEXPLO ( PEDRO)","Gexplo Pedro"}'),
  ('Leffler Dietz',                  '{}'),
  ('TBSA',                           '{}'),
  ('CCS',                            '{}'),
  ('COMUNICAR',                      '{"Comunicar"}'),
  ('Cabañas El Picapalo',            '{"El Picapalo"}'),
  ('Bartolomé',                      '{}'),
  ('Sanguchería',                    '{"Sangucheria por realizar todo"}'),
  ('Wi Comunicación',                '{"Wi Comunicacion"}'),
  ('Contacto Barcelona',             '{"Amigo Tomi Barcelona"}'),
  ('CFI / Gobierno de Entre Ríos',   '{"CFI","Gob ER","CFI / Gob ER"}'),
  ('Mundo Muebles',                  '{"MUNDO MUEBLES","MUNOD MUEBLES"}'),
  ('Activamente Lab',                '{}');

-- ------------------------------------------------------------
-- Proyectos
-- ------------------------------------------------------------

insert into proyectos (organizacion_id, nombre, color, subestado, motivo_gris,
                       motivo_rojo, es_producto_propio, esquema_cobro)
select o.id, v.nombre, v.color::color_estado, v.subestado::subestado_verde,
       v.motivo_gris::motivo_gris, v.motivo_rojo::motivo_rojo,
       v.propio, v.esquema::esquema_cobro
  from (values
    ('SUINO', 'ERP 360, autogestión y tracking', 'verde', 'en_curso', null, null, false, 'por_hitos'),
    ('COTEF', 'Pantalla táctil', 'verde', 'en_curso', null, null, false, 'a_convenir'),
    ('MULTIDEPOT', 'Plataforma administración de espacios', 'verde', 'en_curso', null, null, false, 'a_convenir'),
    ('Stilo Amoblamientos', 'Agente IA y ERP de producción', 'verde', 'en_curso', null, null, false, 'a_convenir'),
    ('Vision Motors', 'Agente conversacional', 'verde', 'bloqueado', null, null, false, 'a_convenir'),
    ('Rodados Integrales', 'Optimización de perfiles', 'verde', 'esperando_cliente', null, null, false, 'a_convenir'),
    ('Rodados Integrales', 'Actualizaciones web', 'verde', 'en_curso', null, null, false, 'a_convenir'),
    ('Remolques INDECAR', 'Sitio web', 'verde', 'esperando_cliente', null, null, false, 'a_convenir'),
    ('Estudio Contable Pepo Rodríguez', 'Sistema para estudio contable', 'verde', 'en_curso', null, null, false, 'a_convenir'),
    ('Geriátrico / Franquicia', 'All in one', 'verde', 'en_curso', null, null, false, 'a_convenir'),
    ('VDOCS', 'Digitalización de documentos', 'verde', 'en_curso', null, null, true, 'a_convenir'),
    ('Paraná Come', 'Ruleta hamburguesa', 'verde', 'en_curso', null, null, true, 'a_convenir'),
    ('Paraná Come', 'Ruleta beneficios', 'verde', 'en_curso', null, null, true, 'a_convenir'),
    ('Transporte Marcelito', 'Ecosistema de transporte', 'amarillo', null, null, null, false, 'a_convenir'),
    ('GEXPLO', 'IA para laboratorio de arena', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Leffler Dietz', 'Agente conversacional', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Leffler Dietz', 'Sistema 360', 'amarillo', null, null, null, false, 'a_convenir'),
    ('TBSA', 'Agente IA, tracking y TV on Touch', 'amarillo', null, null, null, false, 'a_convenir'),
    ('TBSA', 'CRM Zonaprop y Argenprop', 'amarillo', null, null, null, false, 'a_convenir'),
    ('CCS', 'Tótems turneros', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Vision Motors', 'Agente IA', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Vision Motors', 'Trivia para evento', 'amarillo', null, null, null, false, 'a_convenir'),
    ('COMUNICAR', 'Venta de paquete código fuente', 'amarillo', null, null, null, false, 'a_convenir'),
    ('COMUNICAR', 'Propuesta para municipios', 'amarillo', null, null, null, false, 'a_convenir'),
    ('COMUNICAR', 'Tinder de eventos', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Cabañas El Picapalo', 'Sitio web', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Bartolomé', 'Sitio web', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Sanguchería', 'Sitio web', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Wi Comunicación', 'Orden de trabajo en conjunto', 'amarillo', null, null, null, false, 'a_convenir'),
    ('Contacto Barcelona', 'Trabajo en general', 'amarillo', null, null, null, false, 'a_convenir'),
    ('GEXPLO', 'Gestión y trackeo de animales', 'gris', null, 'dormido', null, false, 'a_convenir'),
    ('GEXPLO', 'Rendimiento deportivo rugby', 'gris', null, 'dormido', null, false, 'a_convenir'),
    ('Vision Motors', 'Simulador de juegos', 'gris', null, 'dormido', null, false, 'a_convenir'),
    ('Activamente Lab', 'Sin definir', 'gris', null, 'dormido', null, false, 'a_convenir'),
    ('CFI / Gobierno de Entre Ríos', 'GDE', 'rojo', null, null, 'entregado', false, 'a_convenir'),
    ('CFI / Gobierno de Entre Ríos', 'Entredata', 'rojo', null, null, 'entregado', false, 'a_convenir'),
    ('Mundo Muebles', 'Agente IA, tracking y TV on Touch', 'rojo', null, null, 'descartado', false, 'a_convenir')
  ) as v (cliente, nombre, color, subestado, motivo_gris, motivo_rojo, propio, esquema)
  join organizaciones o on o.nombre_canonico = v.cliente;

-- ------------------------------------------------------------
-- SUINO cargado completo: es el caso más complejo que tenés y
-- sirve para verificar que el reparto da los mismos números
-- que la planilla.
-- ------------------------------------------------------------

do $$
declare
  v_proy uuid;
  v_claudio uuid := '11111111-1111-1111-1111-000000000002';
  v_german  uuid := '11111111-1111-1111-1111-000000000004';
  v_hito uuid;
begin
  select p.id into v_proy
    from proyectos p join organizaciones o on o.id = p.organizacion_id
   where o.nombre_canonico = 'SUINO';

  update proyectos
     set monto_neto = 11000000,
         prioridad = 1,
         fecha_comprometida = date '2026-09-25',
         responsable_id = v_german,
         fecha_inicio = date '2026-06-09'
   where id = v_proy;

  insert into asignaciones (proyecto_id, persona_id, rol, desde) values
    (v_proy, v_claudio, 'desarrollo',      date '2026-06-09'),
    (v_proy, v_german,  'project_manager', date '2026-06-09');

  -- 70 / 30, con Claudio como socio abierto: ve el total y el cálculo.
  insert into participaciones (proyecto_id, persona_id, es_crossity, concepto, porcentaje, apertura) values
    (v_proy, v_claudio, false, 'desarrollo', 70, 'abierta'),
    (v_proy, null,      true,  'gestion',    30, 'abierta');

  -- Las cuatro entregas del cronograma real.
  insert into hitos (proyecto_id, orden, titulo, entregable, porcentaje, monto_neto, es_anticipo, fecha_comprometida)
  values
    (v_proy, 1, '1ª entrega', 'Informe + diccionario de variables + mapa de puntos de captura', 13.64, 1500000, true,  date '2026-06-30'),
    (v_proy, 2, '2ª entrega', 'Sistema activo en planta, ARCA configurado',                     50.00, 5500000, false, date '2026-08-18'),
    (v_proy, 3, '3ª entrega', 'Reporte de trazabilidad + manuales',                             22.73, 2500000, false, date '2026-09-12'),
    (v_proy, 4, '4ª entrega', 'Acta de Recepción Conforme',                                     13.64, 1500000, false, date '2026-09-25');

  -- El impuesto tal como figura en la planilla (6 % del neto).
  -- La etiqueta dice 0,6 % — la diferencia está señalada en el documento.
  insert into impuestos (proyecto_id, hito_id, jurisdiccion, concepto, alicuota, monto)
  select v_proy, h.id, 'nacional', 'Impuesto al cheque (según planilla)', 6, round(h.monto_neto * 0.06, 2)
    from hitos h where h.proyecto_id = v_proy;

  -- Recalcular con los impuestos ya cargados.
  perform recalcular_proyecto(v_proy);

  -- Las dos primeras entregas ya se facturaron y cobraron.
  for v_hito in select id from hitos where proyecto_id = v_proy and orden in (1, 2) order by orden loop
    update hitos set entregado_at = now() - interval '20 days',
                     facturado_at = now() - interval '15 days'
     where id = v_hito;
    update hitos set cobrado_at = now() - interval '10 days' where id = v_hito;
  end loop;

  insert into actualizaciones (proyecto_id, tipo, texto, canal, autor_id) values
    (v_proy, 'entrega',        'Sistema activo en planta. ARCA configurado.', 'nota', v_german),
    (v_proy, 'administrativo', 'Cobrada la 2ª entrega.',                      'nota', v_german);
end $$;

-- ------------------------------------------------------------
-- Usuarios locales para poder entrar y comprobar los permisos.
-- Sólo para el entorno local: en la nube los crea Joel.
-- Contraseña de los tres: crossity-local
-- ------------------------------------------------------------

do $$
declare
  v record;
  v_uid uuid;
begin
  for v in
    -- ids fijos: así no cambian en cada `supabase db reset`
    select * from (values
      ('joel@crossity.ar',   '11111111-1111-1111-1111-000000000001'::uuid, '22222222-2222-2222-2222-000000000001'::uuid),
      ('triana@crossity.ar', '11111111-1111-1111-1111-000000000005'::uuid, '22222222-2222-2222-2222-000000000005'::uuid),
      ('claudio@crossity.ar','11111111-1111-1111-1111-000000000002'::uuid, '22222222-2222-2222-2222-000000000002'::uuid)
    ) as t(mail, persona, uid)
  loop
    v_uid := v.uid;

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      -- GoTrue lee estas columnas como texto no nulo: van vacías, nunca null
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v.mail, crypt('crossity-local', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}', '{}',
      '', '', '', '', '', '', '', ''
    );

    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, v_uid::text,
      format('{"sub":"%s","email":"%s"}', v_uid, v.mail)::jsonb,
      'email', now(), now()
    );

    -- actualizar el mail de la persona si estaba vacío
    update personas set email = v.mail where id = v.persona and email is null;

    insert into usuarios (id, persona_id) values (v_uid, v.persona);
  end loop;
end $$;

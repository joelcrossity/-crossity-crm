-- ============================================================
-- Carga inicial: el padrón y las 38 filas de las planillas.
--
-- Va como migración y no como seed porque no son datos de prueba: es la
-- migración real de las dos hojas maestras y de la planilla de CRONEXIA.
-- Los usuarios de acceso NO se crean acá; se dan de alta en Supabase y
-- después se vinculan a su persona.
-- ============================================================

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
  ('11111111-1111-1111-1111-000000000006', 'Tomás Laurie',      'tomas@crossity.ar',  '{coordinacion}');

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
                       motivo_rojo, es_producto_propio, esquema_cobro, etapa)
select o.id, v.nombre, v.color::color_estado, v.subestado::subestado_verde,
       v.motivo_gris::motivo_gris, v.motivo_rojo::motivo_rojo,
       v.propio, v.esquema::esquema_cobro, v.etapa::etapa_comercial
  from (values
    ('SUINO', 'ERP 360, autogestión y tracking', 'verde', 'en_curso', null, null, false, 'por_hitos', null),
    ('COTEF', 'Pantalla táctil', 'verde', 'en_curso', null, null, false, 'a_convenir', null),
    ('MULTIDEPOT', 'Plataforma administración de espacios', 'verde', 'en_curso', null, null, false, 'a_convenir', null),
    ('Stilo Amoblamientos', 'Agente IA y ERP de producción', 'verde', 'en_curso', null, null, false, 'a_convenir', null),
    ('Vision Motors', 'Agente conversacional', 'verde', 'bloqueado', null, null, false, 'a_convenir', null),
    ('Rodados Integrales', 'Optimización de perfiles', 'verde', 'esperando_cliente', null, null, false, 'a_convenir', null),
    ('Rodados Integrales', 'Actualizaciones web', 'verde', 'en_curso', null, null, false, 'a_convenir', null),
    ('Remolques INDECAR', 'Sitio web', 'verde', 'esperando_cliente', null, null, false, 'a_convenir', null),
    ('Estudio Contable Pepo Rodríguez', 'Sistema para estudio contable', 'verde', 'en_curso', null, null, false, 'a_convenir', null),
    ('Geriátrico / Franquicia', 'All in one', 'verde', 'en_curso', null, null, false, 'a_convenir', null),
    ('VDOCS', 'Digitalización de documentos', 'verde', 'en_curso', null, null, true, 'a_convenir', null),
    ('Paraná Come', 'Ruleta hamburguesa', 'verde', 'en_curso', null, null, true, 'a_convenir', null),
    ('Paraná Come', 'Ruleta beneficios', 'verde', 'en_curso', null, null, true, 'a_convenir', null),
    ('Transporte Marcelito', 'Ecosistema de transporte', 'amarillo', null, null, null, false, 'a_convenir', 'negociacion'),
    ('GEXPLO', 'IA para laboratorio de arena', 'amarillo', null, null, null, false, 'a_convenir', 'relevamiento'),
    ('Leffler Dietz', 'Agente conversacional', 'amarillo', null, null, null, false, 'a_convenir', 'relevamiento'),
    ('Leffler Dietz', 'Sistema 360', 'amarillo', null, null, null, false, 'a_convenir', 'relevamiento'),
    ('TBSA', 'Agente IA, tracking y TV on Touch', 'amarillo', null, null, null, false, 'a_convenir', 'cotizacion'),
    ('TBSA', 'CRM Zonaprop y Argenprop', 'amarillo', null, null, null, false, 'a_convenir', 'relevamiento'),
    ('CCS', 'Tótems turneros', 'amarillo', null, null, null, false, 'a_convenir', 'cotizacion'),
    ('Vision Motors', 'Agente IA', 'amarillo', null, null, null, false, 'a_convenir', 'negociacion'),
    ('Vision Motors', 'Trivia para evento', 'amarillo', null, null, null, false, 'a_convenir', 'relevamiento'),
    ('COMUNICAR', 'Venta de paquete código fuente', 'amarillo', null, null, null, false, 'a_convenir', 'cotizacion'),
    ('COMUNICAR', 'Propuesta para municipios', 'amarillo', null, null, null, false, 'a_convenir', 'cotizacion'),
    ('COMUNICAR', 'Tinder de eventos', 'amarillo', null, null, null, false, 'a_convenir', 'relevamiento'),
    ('Cabañas El Picapalo', 'Sitio web', 'amarillo', null, null, null, false, 'a_convenir', 'cotizacion'),
    ('Bartolomé', 'Sitio web', 'amarillo', null, null, null, false, 'a_convenir', 'primera_charla'),
    ('Sanguchería', 'Sitio web', 'amarillo', null, null, null, false, 'a_convenir', 'interes'),
    ('Wi Comunicación', 'Orden de trabajo en conjunto', 'amarillo', null, null, null, false, 'a_convenir', 'primera_charla'),
    ('Contacto Barcelona', 'Trabajo en general', 'amarillo', null, null, null, false, 'a_convenir', 'primera_charla'),
    ('GEXPLO', 'Gestión y trackeo de animales', 'gris', null, 'dormido', null, false, 'a_convenir', null),
    ('GEXPLO', 'Rendimiento deportivo rugby', 'gris', null, 'dormido', null, false, 'a_convenir', null),
    ('Vision Motors', 'Simulador de juegos', 'gris', null, 'dormido', null, false, 'a_convenir', null),
    ('Activamente Lab', 'Sin definir', 'gris', null, 'dormido', null, false, 'a_convenir', null),
    ('CFI / Gobierno de Entre Ríos', 'GDE', 'naranja', null, null, null, false, 'a_convenir', null),
    ('CFI / Gobierno de Entre Ríos', 'Entredata', 'naranja', null, null, null, false, 'a_convenir', null),
    ('Mundo Muebles', 'Agente IA, tracking y TV on Touch', 'rojo', null, null, 'descartado', false, 'a_convenir', null)
  ) as v (cliente, nombre, color, subestado, motivo_gris, motivo_rojo, propio, esquema, etapa)
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
         moneda = 'ARS',
         prioridad = 1,
         fecha_comprometida = date '2026-09-25',
         responsable_id = v_german,
         fecha_inicio = date '2026-06-09'
   where id = v_proy;

  -- En SUINO, Claudio intervino en el desarrollo y también en la propuesta:
  -- ve el total. Germán lo gestiona y ve la propuesta y los entregables,
  -- pero no el arreglo interno.
  insert into asignaciones (proyecto_id, persona_id, rol, desde, apertura) values
    (v_proy, v_claudio, 'desarrollo',      date '2026-06-09', 'abierta'),
    (v_proy, v_german,  'project_manager', date '2026-06-09', 'comercial');

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

  -- 0,6 %: impuesto a los débitos y créditos. La planilla venía
  -- descontando 6 %, diez veces de más, y esa diferencia salía del
  -- bolsillo de todos los participantes.
  insert into impuestos (proyecto_id, hito_id, jurisdiccion, concepto, alicuota, monto, moneda)
  select v_proy, h.id, 'nacional', 'Impuesto a los débitos y créditos', 0.6,
         round(h.monto_neto * 0.006, 2), 'ARS'
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
-- Un mantenimiento real y uno que arranca solo, para que el caso
-- exista desde el primer día y no sea una hipótesis.
-- ------------------------------------------------------------

do $$
declare
  v_stilo uuid;
  v_mant  uuid;
begin
  -- Stilo figura en la planilla como "En produccioon · mantenimiento":
  -- es un proyecto entregado que ya está en abono.
  select p.id into v_stilo
    from proyectos p join organizaciones o on o.id = p.organizacion_id
   where o.nombre_canonico = 'Stilo Amoblamientos' and p.tipo = 'proyecto';

  update proyectos
     set color = 'naranja', subestado = null, motivo_rojo = null
   where id = v_stilo;

  v_mant := pasar_a_mantenimiento(v_stilo, 180000, date '2026-07-01', false);

  -- El mismo Claudio, en otro proyecto, a ciegas: ahí sólo desarrolla.
  -- Misma persona, mismo rol, apertura distinta. Ése era el punto.
  insert into participaciones (proyecto_id, persona_id, es_crossity, concepto, porcentaje, apertura)
  values (v_mant, '11111111-1111-1111-1111-000000000002', false, 'desarrollo', 60, 'cerrada'),
         (v_mant, null, true, 'gestion', 40, 'abierta');
end $$;

-- Stilo es el único mantenimiento vigente hoy. El caso del abono que
-- arranca sin obra previa está soportado, pero no se inventa acá.

-- ------------------------------------------------------------
-- El grupo gastronómico: una cuenta, dos marcas, dos razones sociales.
-- Es el caso que obligó a separar cuenta de razón social.
-- ------------------------------------------------------------

insert into organizaciones (nombre_canonico, alias)
values ('Grupo gastronómico', '{"Sushi Paraná","Gurichan","Grupo Sushi Paraná"}');

do $$
declare
  v_cuenta uuid;
  v_rs1 uuid; v_rs2 uuid;
begin
  select id into v_cuenta from organizaciones where nombre_canonico = 'Grupo gastronómico';

  insert into razones_sociales (organizacion_id, razon_social, es_principal)
  values (v_cuenta, 'Razón social de Sushi Paraná', true) returning id into v_rs1;

  insert into razones_sociales (organizacion_id, razon_social)
  values (v_cuenta, 'Razón social de Gurichan') returning id into v_rs2;

  insert into marcas (organizacion_id, nombre, razon_social_id, es_principal) values
    (v_cuenta, 'Sushi Paraná', v_rs1, true),
    (v_cuenta, 'Gurichan',     v_rs2, false);
end $$;

-- El resto de los clientes arranca con una razón social y una marca,
-- que es el caso normal. Los CUIT se cargan cuando haga falta facturar.
insert into razones_sociales (organizacion_id, razon_social, es_principal)
select o.id, o.nombre_canonico, true
  from organizaciones o
 where o.nombre_canonico <> 'Grupo gastronómico';

insert into marcas (organizacion_id, nombre, es_principal)
select o.id, o.nombre_canonico, true
  from organizaciones o
 where o.nombre_canonico <> 'Grupo gastronómico';

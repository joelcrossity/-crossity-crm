-- ------------------------------------------------------------------
-- Una entrega puede regalarse sin que se regale el proyecto entero.
--
-- El sistema ya sabía de trabajo bonificado, pero sólo para el proyecto
-- completo: proyectos.condicion dice normal, bonificado o descuento. Y
-- el caso real es otro, más común y más comercial: el proyecto se cobra
-- y una parte se regala. Se hace el ERP y se bonifica el sitio.
--
-- Hasta ahora eso se cargaba como una entrega en cero, que es lo único
-- que se podía. Pero cero y regalado no son lo mismo y el sistema no
-- podía distinguirlos: una entrega en cero se lee como "todavía no le
-- pusimos precio", aparece en las listas de lo que falta cotizar, y
-- desaparece del resumen que ve el cliente.
--
-- Y eso último es lo que más duele, porque es justamente lo que uno
-- quiere que el cliente vea. Regalar algo y que no se note es pagar el
-- costo sin cobrar el gesto.
--
-- Se reusa el enum que ya existe en vez de inventar un campo nuevo:
-- bonificado significa lo mismo en una entrega que en un proyecto, y
-- dos palabras para lo mismo terminan queriendo decir cosas distintas.
--
-- El motivo es obligatorio, igual que en proyectos. Regalar trabajo es
-- una decisión comercial y dentro de seis meses alguien va a preguntar
-- por qué se hizo. "Para cerrar el ERP" es una respuesta; el silencio
-- no.
-- ------------------------------------------------------------------

alter table hitos
  add column if not exists condicion condicion_comercial not null default 'normal',
  add column if not exists motivo_condicion text;

alter table hitos drop constraint if exists hito_bonificado_con_motivo;
alter table hitos add constraint hito_bonificado_con_motivo check (
  condicion = 'normal' or (motivo_condicion is not null and length(trim(motivo_condicion)) > 0)
);

-- Lo regalado vale cero para el cliente. Si tiene precio, o no está
-- bonificado o el precio quedó de un cambio anterior y miente.
alter table hitos drop constraint if exists bonificado_no_se_cobra;
alter table hitos add constraint bonificado_no_se_cobra check (
  condicion <> 'bonificado' or monto_neto = 0
);

comment on column hitos.condicion is
  'Normal, bonificado o descuento. Bonificado es trabajo entregado que se regaló a propósito: no es lo mismo que una entrega sin precio.';
comment on column hitos.motivo_condicion is
  'Por qué se regaló o se descontó. Obligatorio: en seis meses alguien va a preguntar.';


-- Nota para el que venga: v_sin_cotizar NO es esto. Esa vista habla de
-- alcance presentado al cliente que necesita relevamiento antes de
-- poder ponerle número, y vive en componentes. Una entrega bonificada
-- no aparece ahí y no hay que tocarla. Lo escribo porque estuve a punto
-- de pisarla pensando que era lo mismo: los dos se llaman "sin
-- cotizar" en la cabeza de uno y son cosas distintas.

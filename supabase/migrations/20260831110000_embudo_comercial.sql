-- ============================================================
-- El embudo comercial.
--
-- Sale de dos lugares: lo que Joel describe que hacen, y lo que la
-- planilla de CRONEXIA ya venía registrando bien. La planilla tenía
-- etapa, nurturing, próxima acción y fecha de seguimiento; el proceso
-- hablado agrega las dos etapas de arriba, que son las que no se asientan.
-- ============================================================

create type etapa_comercial as enum (
  'interes',        -- apareció. Sabemos que existe y de dónde vino
  'primera_charla', -- hubo contacto real, se habló
  'relevamiento',   -- se está entendiendo qué necesita
  'cotizacion',     -- se armó y se envió la propuesta
  'negociacion',    -- contestó, se está ajustando
  'ganado'          -- se convierte en proyecto
);

-- De dónde vino. Es lo que después dice qué canal produce plata.
create type origen_lead as enum (
  'recomendacion', 'referido', 'entrante_web', 'whatsapp',
  'evento', 'cliente_existente', 'salida_propia', 'otro'
);

-- Eje aparte de la etapa: si el trabajo de relación está hecho.
-- Se puede estar negociando con el nurturing pendiente, y eso es una
-- señal de alarma, no un detalle.
create type estado_nurturing as enum ('pendiente', 'en_proceso', 'completado');

-- "No se dio" no es lo mismo que "perdido": nadie decidió nada, se apagó.
-- Ése vuelve, y por eso va a gris y no a rojo.
alter type motivo_gris add value 'no_se_dio';

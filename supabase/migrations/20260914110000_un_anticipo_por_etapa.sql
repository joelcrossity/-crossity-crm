-- ------------------------------------------------------------------
-- Un anticipo por etapa, no uno por proyecto.
--
-- El índice decía: un solo hito marcado como anticipo por proyecto. Era
-- correcto mientras un proyecto se cotizaba de una sola vez —hay un
-- anticipo y después entregas—. Con la cotización en etapas deja de
-- serlo: cada etapa se negocia aparte y cada una tiene su propio
-- anticipo. Es exactamente el supuesto viejo, escrito como regla.
--
-- Se afloja al nivel que corresponde: uno por etapa. Los trabajos sin
-- etapas siguen con uno solo, porque para ellos etapa_id es nulo y el
-- índice los agrupa a todos bajo el mismo proyecto.
-- ------------------------------------------------------------------

drop index if exists hitos_un_solo_anticipo;

-- Con etapa: uno por etapa.
create unique index hitos_un_anticipo_por_etapa
  on hitos (etapa_id) where es_anticipo and etapa_id is not null;

-- Sin etapa: uno por proyecto, como siempre.
create unique index hitos_un_anticipo_suelto
  on hitos (proyecto_id) where es_anticipo and etapa_id is null;

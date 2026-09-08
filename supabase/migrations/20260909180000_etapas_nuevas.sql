-- Dos etapas nuevas, en su lugar del recorrido.
--
-- "Cotización" hacía dos trabajos a la vez: hay que armar la propuesta,
-- y ya se mandó y estamos esperando. Son momentos distintos y piden
-- cosas distintas —uno es trabajo nuestro, el otro es esperar—, así que
-- confundirlos hace que el que espera parezca que avanza.
--
-- Va sola: Postgres no deja usar un valor de enum en la misma
-- transacción en que se agrega.

alter type etapa_comercial add value 'a_cotizar'  before 'cotizacion';
alter type etapa_comercial add value 'cotizado'   after  'cotizacion';

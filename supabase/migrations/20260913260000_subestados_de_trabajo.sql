-- Los valores del enum van solos: Postgres no deja agregarlos y usarlos
-- en la misma transacción.
alter type subestado_verde add value if not exists 'implementando';
alter type subestado_verde add value if not exists 'en_revision';

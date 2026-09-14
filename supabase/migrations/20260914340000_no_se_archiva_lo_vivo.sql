-- ------------------------------------------------------------------
-- No se puede archivar trabajo que está en curso.
--
-- Archivar no pedía nada: se podía archivar un proyecto en verde,
-- implementándose, con entregas por delante. Y al archivarse desaparece
-- de todos lados —del tablero, de la franja, de Hoy, de la previsión de
-- cobros— sin decir nada y sin dejar de ser trabajo comprometido.
--
-- Pasó. Tomás es responsable de cinco proyectos y la franja le decía
-- cero. Cuatro estaban bien excluidos: dos terminados, dos todavía en el
-- embudo. El quinto, Inventario, estaba en verde e implementándose, y
-- archivado. Su único proyecto vivo, invisible.
--
-- Y el síntoma no se parecía a la causa: durante dos días esto pareció
-- un problema de permisos, después uno de filtrado por rol, después un
-- bug de conteo. No era nada de eso. Los números estaban bien y el dato
-- estaba mal, y no había forma de que el sistema lo dijera porque no
-- consideraba que fuera un error.
--
-- Este CRM existe para que Joel no tenga que ser el índice de la
-- empresa. Un proyecto vivo que no aparece en ninguna lista es
-- exactamente la clase de cosa que vuelve a meterlo en el medio: alguien
-- se tiene que acordar de que existe.
--
-- Verde es lo único que se bloquea. Amarillo se archiva —una oportunidad
-- que no fue—, gris también —pausado o dormido es justo lo que se
-- guarda—, y naranja y rojo son finales. Verde significa que alguien
-- está trabajando en esto ahora.
-- ------------------------------------------------------------------

create or replace function archivar(p_proyecto uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_color text;
begin
  select color::text into v_color from proyectos where id = p_proyecto;

  if v_color = 'verde' then
    raise exception 'Esto está en curso. Cerralo primero —terminado, perdido o descartado— y ahí se archiva. Si hay que sacarlo de la vista sin cerrarlo, ponelo en standby.';
  end if;

  update proyectos
     set archivado_at = now(),
         archivado_por = persona_actual()
   where id = p_proyecto
     and archivado_at is null;

  if not found then
    raise exception 'No se pudo archivar: o no existe, o ya estaba archivado, o no tenés permiso';
  end if;
end;
$$;

comment on function archivar is
  'Guarda un proyecto cerrado. Lo que está en verde no: archivar trabajo en curso lo hace invisible sin dejar de estar comprometido.';

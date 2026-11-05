-- La bitácora comparte base con las denuncias. Con hora exacta, quien tenga un volcado físico
-- puede ordenar por xmin o ctid y acotar a segundos la llegada de una denuncia (que solo guarda
-- el día) entre dos acciones del panel. Truncar a la hora reduce esa ventana; el orden de
-- llegada que revelan xmin y ctid sigue siendo un riesgo residual documentado en el README.
ALTER TABLE bitacora_autoridad
  ALTER COLUMN creado_en SET DEFAULT date_trunc('hour', now());

UPDATE bitacora_autoridad SET creado_en = date_trunc('hour', creado_en)
  WHERE creado_en <> date_trunc('hour', creado_en);

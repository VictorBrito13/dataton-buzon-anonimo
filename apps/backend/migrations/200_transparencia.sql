-- Datos abiertos: k vigente por fila e indicadores por ente en la misma tabla, porque es la única
-- que puede leer la API pública.
ALTER TABLE agregados_publicos ADD COLUMN k integer NOT NULL DEFAULT 5;
ALTER TABLE agregados_publicos ALTER COLUMN k DROP DEFAULT;
ALTER TABLE agregados_publicos ADD COLUMN detalle jsonb;

-- D6, regla 7: la API pública se conecta con este rol. Solo puede leer agregados_publicos.
-- La contraseña es solo para desarrollo; en producción, cambiarla con ALTER ROLE y configurar
-- DATABASE_URL_PUBLICO.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'buzon_lector_publico') THEN
    CREATE ROLE buzon_lector_publico LOGIN PASSWORD 'lector_publico_solo_desarrollo'
      NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM buzon_lector_publico;
REVOKE CREATE ON SCHEMA public FROM buzon_lector_publico;
GRANT USAGE ON SCHEMA public TO buzon_lector_publico;
GRANT SELECT ON agregados_publicos TO buzon_lector_publico;

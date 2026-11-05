-- Esquema base del buzón. Regla: ninguna columna guarda IP, user-agent, ni
-- marcas de tiempo con hora en datos ligados a una denuncia. Los identificadores
-- son aleatorios para que el orden de llegada no pueda inferirse.
CREATE TABLE denuncias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio_hmac      bytea NOT NULL UNIQUE,
  acceso_hmac     bytea NOT NULL UNIQUE,
  estado          char(2) NOT NULL,
  municipio       char(5),
  tipo_falta      text NOT NULL,
  ente_id         text,
  etapa           text NOT NULL DEFAULT 'recibida',
  recibida_dia    date NOT NULL,
  relato_sellado  bytea NOT NULL
);

CREATE TABLE denuncia_etapas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id uuid NOT NULL REFERENCES denuncias (id) ON DELETE CASCADE,
  etapa       text NOT NULL,
  dia         date NOT NULL
);
CREATE INDEX ON denuncia_etapas (denuncia_id);

-- denuncia_id nulo: subida aún no ligada; una limpieza periódica la elimina.
CREATE TABLE evidencias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id   uuid REFERENCES denuncias (id) ON DELETE CASCADE,
  tipo          text NOT NULL,
  blob_sellado  bytea NOT NULL,
  subida_dia    date NOT NULL
);
CREATE INDEX ON evidencias (denuncia_id);

-- Un mensaje lleva cuerpo_cifrado (autoridad, cifrado en reposo con clave de
-- servidor) o cuerpo_sellado (denunciante, solo legible por la autoridad).
CREATE TABLE mensajes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id    uuid NOT NULL REFERENCES denuncias (id) ON DELETE CASCADE,
  autor          text NOT NULL CHECK (autor IN ('autoridad', 'denunciante')),
  cuerpo_cifrado bytea,
  cuerpo_sellado bytea,
  dia            date NOT NULL,
  CHECK ((cuerpo_cifrado IS NULL) <> (cuerpo_sellado IS NULL))
);
CREATE INDEX ON mensajes (denuncia_id);

CREATE TABLE autoridad_usuarios (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario         text NOT NULL UNIQUE,
  contrasena_hash text NOT NULL
);

-- La bitácora rinde cuentas sobre el personal, no sobre quien denuncia; por eso sí lleva hora.
CREATE TABLE bitacora_autoridad (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid NOT NULL REFERENCES autoridad_usuarios (id),
  accion      text NOT NULL,
  denuncia_id uuid REFERENCES denuncias (id) ON DELETE SET NULL,
  creado_en   timestamptz NOT NULL DEFAULT now()
);

-- Única tabla que puede leer la API pública. Se llena solo con el motor de k-anonimato.
CREATE TABLE agregados_publicos (
  periodo     text NOT NULL,
  dimensiones text NOT NULL,
  claves      jsonb NOT NULL,
  conteo      integer,
  motivo      text NOT NULL,
  PRIMARY KEY (periodo, dimensiones, claves)
);

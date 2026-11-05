-- Sin hora en estos datos, el orden dentro de un mismo día se perdería. Un consecutivo por denuncia
-- conserva la conversación y la línea de tiempo sin revelar a qué hora ocurrió nada.
ALTER TABLE denuncia_etapas ADD COLUMN orden integer NOT NULL DEFAULT 1;
ALTER TABLE mensajes ADD COLUMN orden integer NOT NULL DEFAULT 1;

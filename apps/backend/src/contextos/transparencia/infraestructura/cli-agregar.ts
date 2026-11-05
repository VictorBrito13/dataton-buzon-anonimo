import { closeDatabase, pool } from "../../../db/postgres.js";
import { agregarPeriodos } from "../aplicacion/agregar-periodos.js";
import { K_INICIAL, REZAGO_DIAS_INICIAL } from "../dominio/metodologia.js";
import { ENTES_SINTETICOS } from "@dataton/shared";
import { leerMunicipios } from "./fuente-pdn-instantaneas.js";
import { crearFuenteDenuncias, crearRepositorioPublicacion } from "./repositorios-postgres.js";

/** Publica los trimestres cerrados que falten. Uso: npm run agregar -w @dataton/backend */
const principal = async (): Promise<void> => {
  const publicados = await agregarPeriodos(
    crearFuenteDenuncias(pool),
    crearRepositorioPublicacion(pool),
    {
      k: Number(process.env.TRANSPARENCIA_K ?? K_INICIAL),
      rezagoDias: Number(process.env.TRANSPARENCIA_REZAGO_DIAS ?? REZAGO_DIAS_INICIAL),
      hoy: new Date().toISOString().slice(0, 10),
      desde: process.env.TRANSPARENCIA_DESDE ?? "2025-T1",
      universo: {
        municipios: leerMunicipios(),
        entes: ENTES_SINTETICOS.map((e) => e.id),
      },
    },
  );
  console.log(`[agregacion] publicados: ${publicados.join(", ") || "ninguno"}`);
};

principal()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void closeDatabase());

import { randomBytes } from "node:crypto";
import { MAX_EVIDENCIAS } from "./contextos/denuncias/dominio/denuncia.js";
import { TIPOS_EVIDENCIA } from "./contextos/evidencias/dominio/politica.js";
import { env, isProduction } from "./config/env.js";
import { LimiteIntentos } from "./compartido/dominio/limite-intentos.js";
import { Semaforo } from "./compartido/dominio/semaforo.js";
import { CifradorAes } from "./compartido/infraestructura/cifrador-aes.js";
import { HuellasHmac } from "./compartido/infraestructura/huellas-hmac.js";
import { PowAltcha } from "./compartido/infraestructura/pow-altcha.js";
import { ConsultarDenuncia } from "./contextos/denuncias/aplicacion/consultar-denuncia.js";
import { CrearDenuncia } from "./contextos/denuncias/aplicacion/crear-denuncia.js";
import { EnviarMensajeDenunciante } from "./contextos/denuncias/aplicacion/enviar-mensaje-denunciante.js";
import { PuertaAcceso } from "./contextos/denuncias/aplicacion/puerta-acceso.js";
import { RepositorioDenunciasPg } from "./contextos/denuncias/infraestructura/repositorio-denuncias-pg.js";
import { crearAdaptadorS5 } from "./contextos/denuncias/infraestructura/s5/crear-adaptador.js";
import { LimpiarEvidenciasHuerfanas } from "./contextos/evidencias/aplicacion/limpiar-huerfanas.js";
import { RecibirEvidencia } from "./contextos/evidencias/aplicacion/recibir-evidencia.js";
import { SelladorClavePublica } from "./contextos/evidencias/infraestructura/adaptadores.js";
import { DetectorFileType } from "./contextos/evidencias/infraestructura/detector-file-type.js";
import { LimpiadorEnWorker } from "./contextos/evidencias/infraestructura/limpiador-en-worker.js";
import { RepositorioEvidenciasPg } from "./contextos/evidencias/infraestructura/repositorio-evidencias-pg.js";
import { CasosDenunciasAutoridad } from "./contextos/tramite/aplicacion/casos-denuncias.js";
import { CasosSesion } from "./contextos/tramite/aplicacion/casos-sesion.js";
import {
  AlmacenSesionesMemoria,
  RepositorioUsuariosPg,
  VerificadorArgon2,
} from "./contextos/tramite/infraestructura/adaptadores.js";
import { RepositorioTramitePg } from "./contextos/tramite/infraestructura/repositorio-tramite-pg.js";

/** Raíz de composición: el único lugar que conoce a la vez configuración, casos de uso y adaptadores. */
const reloj = { ahora: () => new Date(), zona: env.zonaHoraria };
const azar = { bytes: (cantidad: number) => new Uint8Array(randomBytes(cantidad)) };
const cifrador = new CifradorAes(env.claveMensajes);
const huellas = new HuellasHmac(env.pimientaAcceso);

export const pow = new PowAltcha({
  claveHmac: env.altchaClaveHmac,
  costo: env.powCosto,
  contadorMax: env.powContadorMax,
  expiraSeg: env.powExpiraSeg,
  maxUsados: 200_000,
});

const repositorioDenuncias = new RepositorioDenunciasPg();
const repositorioEvidencias = new RepositorioEvidenciasPg();
const repositorioTramite = new RepositorioTramitePg();

/** Mismos límites para consultar y para crear; instancias aparte para que uno no agote al otro. */
const limitesSinCuenta = () => ({
  limiteCredencial: new LimiteIntentos({
    maximo: env.accesoIntentosCredencial,
    ventanaMs: env.accesoVentanaMs,
    maxClaves: 100_000,
  }),
  limiteGlobal: new LimiteIntentos({
    maximo: env.accesoLimiteGlobal,
    ventanaMs: 60_000,
    maxClaves: 1,
  }),
});

const puerta = new PuertaAcceso({
  repositorio: repositorioDenuncias,
  huellas,
  reloj,
  pow,
  ...limitesSinCuenta(),
});

/** Limpiezas de archivos a la vez; el resto espera un tiempo acotado y luego recibe 503. */
export const semaforoLimpiezas = new Semaforo({
  maximo: env.limpiezasSimultaneas,
  esperaMaxMs: env.limpiezasEsperaMs,
});

export const casos = {
  crearDenuncia: new CrearDenuncia(
    { repositorio: repositorioDenuncias, huellas, reloj, pow, azar, ...limitesSinCuenta() },
    env.maxBytesEvidenciasTotal,
  ),
  consultar: new ConsultarDenuncia({ puerta, repositorio: repositorioDenuncias, cifrador }),
  enviarMensaje: new EnviarMensajeDenunciante({
    puerta,
    repositorio: repositorioDenuncias,
    reloj,
  }),
  recibirEvidencia: new RecibirEvidencia(
    {
      detector: new DetectorFileType(),
      // PDF y Office se limpian en un worker por archivo, con plazo y memoria acotados.
      limpiador: new LimpiadorEnWorker({
        tiempoMaxMs: env.limpiezaTiempoMaxMs,
        memoriaMaxMb: env.limpiezaMemoriaMaxMb,
      }),
      sellador: new SelladorClavePublica(env.clavePublicaAutoridad),
      repositorio: repositorioEvidencias,
      reloj,
    },
    { maxBytes: env.maxBytesEvidencia, cuotaHuerfanas: env.cuotaHuerfanas },
  ),
  sesion: new CasosSesion(
    {
      usuarios: new RepositorioUsuariosPg(),
      hasher: new VerificadorArgon2(),
      almacen: new AlmacenSesionesMemoria(),
      bitacora: repositorioTramite,
      reloj,
      limite: new LimiteIntentos({ maximo: 10, ventanaMs: 15 * 60_000, maxClaves: 100_000 }),
      limiteGlobal: new LimiteIntentos({
        maximo: env.sesionLimiteGlobal,
        ventanaMs: 60_000,
        maxClaves: 1,
      }),
    },
    env.sesionDuracionMs,
  ),
  denunciasAutoridad: new CasosDenunciasAutoridad({
    repositorio: repositorioTramite,
    cifrador,
    reloj,
  }),
};

export const limpiarHuerfanas = new LimpiarEvidenciasHuerfanas({
  repositorio: repositorioEvidencias,
  reloj,
});

/** Frontera con el S5, para quien la necesite. Hoy ningún caso de uso envía denuncias por ella. */
export const adaptadorS5 = crearAdaptadorS5(env.s5);

export const configuracionPublica = {
  clavePublicaAutoridad: env.clavePublicaAutoridad,
  maxBytesEvidencia: env.maxBytesEvidencia,
  maxEvidencias: MAX_EVIDENCIAS,
  tiposEvidencia: TIPOS_EVIDENCIA,
};

export const cookieSegura = isProduction;

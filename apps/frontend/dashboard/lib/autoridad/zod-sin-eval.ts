import { z } from "zod";

/**
 * Zod prueba `new Function("")` al construir el primer esquema de objeto, y la CSP
 * estricta lo reporta como violación aunque Zod atrape el error. Debe evaluarse antes
 * que @dataton/shared: cada punto de entrada del panel lo importa en primer lugar.
 */
z.config({ jitless: true });

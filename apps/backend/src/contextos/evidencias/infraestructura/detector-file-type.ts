import { fileTypeFromBuffer } from "file-type";
import type { DetectorTipo } from "../aplicacion/puertos.js";

export class DetectorFileType implements DetectorTipo {
  async detectar(bytes: Uint8Array): Promise<string | null> {
    return (await fileTypeFromBuffer(bytes))?.mime ?? null;
  }
}

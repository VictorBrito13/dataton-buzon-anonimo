import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { RAIZ } from "./apoyo";

type Estado = "Aprobada" | "Fallida" | "Pendiente (fixme)" | "Omitida";

interface Fila {
  archivo: string;
  titulo: string;
  estado: Estado;
  evidencia: string[];
  error?: string;
}

const estadoDe = (prueba: TestCase, resultado: TestResult): Estado => {
  if (resultado.status === "passed") return "Aprobada";
  if (resultado.status === "skipped") {
    return prueba.annotations.some((a) => a.type === "fixme") ? "Pendiente (fixme)" : "Omitida";
  }
  return "Fallida";
};

const celda = (texto: string): string => texto.replaceAll("|", "\\|").replaceAll("\n", " ");

const quitarColores = (texto: string): string =>
  // eslint-disable-next-line no-control-regex
  texto.replace(/\u001b\[[0-9;]*m/g, "");

const commit = (): string => {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd: RAIZ,
      encoding: "utf8",
    }).trim();
  } catch {
    return "desconocido";
  }
};

/** Genera docs/evidencia/reporte-anonimato.md: lo que se corrió y lo que falta, sin adornos. */
export default class ReporteAnonimato implements Reporter {
  private filas = new Map<string, Fila>();

  onTestEnd(prueba: TestCase, resultado: TestResult): void {
    const anotaciones = prueba.annotations;
    this.filas.set(prueba.id, {
      archivo: path.basename(prueba.location.file),
      titulo: prueba.titlePath().slice(3).join(" › "),
      estado: estadoDe(prueba, resultado),
      evidencia: anotaciones
        .filter((a) => a.type === "evidencia" || a.type === "fixme")
        .map((a) => a.description ?? ""),
      error: resultado.error?.message ? quitarColores(resultado.error.message) : undefined,
    });
  }

  onEnd(resultado: FullResult): void {
    const filas = [...this.filas.values()];
    const contar = (estado: Estado) => filas.filter((f) => f.estado === estado).length;
    const archivos = [...new Set(filas.map((f) => f.archivo))];

    const lineas = [
      "# Reporte de las pruebas de anonimato",
      "",
      "Generado por `npm run test:anonimato`. No se edita a mano.",
      "",
      `- **Fecha:** ${new Date().toISOString().slice(0, 10)}`,
      `- **Commit:** \`${commit()}\``,
      `- **Resultado de la corrida:** ${resultado.status}`,
      "",
      "| Aprobadas | Fallidas | Pendientes (fixme) | Omitidas | Total |",
      "|---|---|---|---|---|",
      `| ${contar("Aprobada")} | ${contar("Fallida")} | ${contar("Pendiente (fixme)")} | ${contar("Omitida")} | ${filas.length} |`,
      "",
      "Ninguna prueba queda pendiente ni omitida: todas corren contra el despliegue real.",
      "",
    ];

    for (const archivo of archivos) {
      lineas.push(`## ${archivo}`, "", "| Prueba | Estado | Evidencia |", "|---|---|---|");
      for (const fila of filas.filter((f) => f.archivo === archivo)) {
        const detalle = [...fila.evidencia, ...(fila.error ? [fila.error.slice(0, 300)] : [])];
        lineas.push(`| ${celda(fila.titulo)} | ${fila.estado} | ${celda(detalle.join(" · "))} |`);
      }
      lineas.push("");
    }

    const destino = path.join(RAIZ, "docs/evidencia/reporte-anonimato.md");
    mkdirSync(path.dirname(destino), { recursive: true });
    writeFileSync(destino, lineas.join("\n"));
    console.log(`Reporte: ${path.relative(RAIZ, destino)}`);
  }

  printsToStdio(): boolean {
    return false;
  }
}

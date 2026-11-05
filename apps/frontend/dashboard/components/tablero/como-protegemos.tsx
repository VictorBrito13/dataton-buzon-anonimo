import type { RespuestaMetodologia } from "@dataton/shared";
import { TablaDesplazable } from "./piezas";

type Fila = RespuestaMetodologia["ejemploAtaque"]["original"][number];

function TablaEjemplo({ titulo, filas, k }: { titulo: string; filas: readonly Fila[]; k: number }) {
  const mostrar = (valor: number | null, esPequena: boolean): string => {
    if (valor !== null) return String(valor);
    return esPequena ? `< ${k}` : "Oculta";
  };
  return (
    <TablaDesplazable titulo={titulo}>
      <thead>
        <tr>
          <th scope="col">Municipio</th>
          <th scope="col">Cohecho</th>
          <th scope="col">Abuso</th>
          <th scope="col">Total</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.municipio}>
            <th scope="row">{f.municipio}</th>
            <td className="tabular-nums">{mostrar(f.cohecho, f.municipio === "C")}</td>
            <td className="tabular-nums">{mostrar(f.abuso, false)}</td>
            <td className="tabular-nums">{mostrar(f.total, false)}</td>
          </tr>
        ))}
      </tbody>
    </TablaDesplazable>
  );
}

export function ComoProtegemos({ metodologia }: { metodologia: RespuestaMetodologia }) {
  const { k, ejemploAtaque, reglas, garantia, noCubre, rezagoDias } = metodologia;
  const { original, protegida, rango } = ejemploAtaque;
  const sinProteccion: Fila[] = original.map((f) =>
    f.municipio === "C" ? { ...f, cohecho: null } : f,
  );
  return (
    <div className="space-y-4">
      <p className="max-w-prose">
        Una cifra pequeña puede señalar a quien denunció. En un municipio con una sola dependencia,
        «1 denuncia de cohecho» casi le pone nombre. Por eso ninguna cifra menor que {k} se publica.
        Pero ocultarla no basta.
      </p>
      {/* min-w-0: la tabla se desplaza dentro de su recuadro en vez de ensanchar la página. */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h3 className="font-semibold">El ataque: una resta</h3>
          <TablaEjemplo titulo="Ejemplo sin supresión complementaria" filas={sinProteccion} k={k} />
          <p className="text-sm">
            La celda de C dice «&lt; {k}», pero cualquiera calcula 9 − 8 = <strong>1</strong>. El
            total reveló lo que la celda ocultaba.
          </p>
        </div>
        <div className="min-w-0 space-y-2">
          <h3 className="font-semibold">Por qué aquí falla</h3>
          <TablaEjemplo titulo="El mismo ejemplo, protegido por el motor" filas={protegida} k={k} />
          <p className="text-sm">
            El motor oculta también otras celdas de la misma fila y columna. Ahora hay dos
            incógnitas por ecuación: lo mejor que logra un atacante es un rango de{" "}
            <strong>
              {rango.min} a {rango.max}
            </strong>
            , igual que antes de hacer cuentas. Esta tabla no está escrita a mano: la calcula el
            motor de este sitio.
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-semibold">Las reglas</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm">
          {reglas.map((regla) => (
            <li key={regla}>{regla}</li>
          ))}
        </ol>
        <p className="mt-2 text-sm">
          Cada trimestre se publica {rezagoDias} días después de cerrar, y una vez publicado no
          cambia.
        </p>
      </div>

      <div>
        <h3 className="font-semibold">Qué garantizamos, exactamente</h3>
        <p className="mt-1 text-sm">{garantia}</p>
      </div>
      <div>
        <h3 className="font-semibold">Qué no garantizamos</h3>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {noCubre.map((texto) => (
            <li key={texto}>{texto}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

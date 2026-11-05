/** Lleva el prefijo `buzon:` para que la salida rápida también la borre. */
export const CLAVE_TEMA = "buzon:tema";
const ATRIBUTO = "data-tema";

export const PREFERENCIAS_TEMA = ["claro", "oscuro", "automatico"] as const;
export type PreferenciaTema = (typeof PREFERENCIAS_TEMA)[number];

type AlmacenTema = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const normalizarPreferencia = (valor: string | null): PreferenciaTema =>
  PREFERENCIAS_TEMA.find((preferencia) => preferencia === valor) ?? "automatico";

/** Acceder al almacenamiento puede lanzar un error en modo privado o con datos bloqueados. */
export const leerPreferencia = (almacen: Pick<AlmacenTema, "getItem">): PreferenciaTema => {
  try {
    return normalizarPreferencia(almacen.getItem(CLAVE_TEMA));
  } catch {
    return "automatico";
  }
};

/** «Automático» es el valor por omisión: no se escribe nada que delate el uso del sitio. */
export const guardarPreferencia = (almacen: AlmacenTema, preferencia: PreferenciaTema): void => {
  try {
    if (preferencia === "automatico") almacen.removeItem(CLAVE_TEMA);
    else almacen.setItem(CLAVE_TEMA, preferencia);
  } catch {
    // El tema sigue aplicado en esta página aunque no se pueda recordar.
  }
};

export const aplicarPreferencia = (raiz: Element, preferencia: PreferenciaTema): void => {
  if (preferencia === "automatico") raiz.removeAttribute(ATRIBUTO);
  else raiz.setAttribute(ATRIBUTO, preferencia);
};

/**
 * Corre en <head>, antes de pintar, con el nonce de la CSP. Solo acepta valores conocidos.
 * Sin JavaScript no hay marca en la raíz y manda `prefers-color-scheme`.
 */
export const scriptTemaInicial = (): string =>
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(CLAVE_TEMA)});` +
  `if(t==="claro"||t==="oscuro")document.documentElement.setAttribute(${JSON.stringify(ATRIBUTO)},t)}catch(e){}})()`;

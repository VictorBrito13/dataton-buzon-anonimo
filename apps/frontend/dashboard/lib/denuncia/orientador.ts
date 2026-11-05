import { TIPOS_FALTA, type TipoFalta } from "@dataton/shared";

/**
 * Orientador «¿Qué puedo denunciar?». Reglas fijas y 100 % locales, sin IA ni red.
 * Las señales retoman las que la SESNA presentó en su versión de pruebas del S5
 * (https://dev-denuncias.plataformadigitalnacional.org/) y apuntan a TIPOS_FALTA.
 */
export const AVISO_ORIENTADOR =
  "Esto es solo orientativo y no constituye una determinación jurídica. La autoridad decide cómo clasificar los hechos.";

export type Quien = "servidor_publico" | "particular";

export const QUIENES: readonly { clave: Quien; etiqueta: string; ayuda: string }[] = [
  {
    clave: "servidor_publico",
    etiqueta: "Alguien que trabaja en gobierno",
    ayuda: "Trabaja en una institución pública o actuaba desde ella.",
  },
  {
    clave: "particular",
    etiqueta: "Una persona o empresa externa",
    ayuda: "No trabaja en gobierno, pero estuvo involucrada en lo que pasó.",
  },
];

interface Senal {
  clave: string;
  etiqueta: string;
  ayuda: string;
  tipoFalta: TipoFalta;
}

const NO_SEGURO: Senal = {
  clave: "no_seguro",
  etiqueta: "No estoy seguro",
  ayuda: "No pasa nada. Tu relato es suficiente para empezar.",
  tipoFalta: "otra",
};

const POSIBLE_DELITO: Senal = {
  clave: "delito",
  etiqueta: "Creo que podría ser un delito",
  ayuda: "Lo que viste parece más grave que una falta en el trabajo.",
  tipoFalta: "hecho_corrupcion",
};

const SENALES: Record<Quien, readonly Senal[]> = {
  servidor_publico: [
    {
      clave: "pidio",
      etiqueta: "Pidió dinero, un regalo o un favor",
      ayuda: "A cambio de hacer, agilizar o no hacer algo.",
      tipoFalta: "cohecho",
    },
    {
      clave: "uso_cargo",
      etiqueta: "Usó su cargo de forma indebida",
      ayuda: "Aprovechó su puesto, su acceso o su autoridad para algo que no debía.",
      tipoFalta: "abuso_funciones",
    },
    {
      clave: "favorecio",
      etiqueta: "Favoreció a alguien",
      ayuda: "Dio trato preferente o acomodó un proceso para una persona o empresa.",
      tipoFalta: "conflicto_interes",
    },
    {
      clave: "oculto",
      etiqueta: "Ocultó, retrasó o incumplió algo",
      ayuda: "No hizo lo que le tocaba, lo demoró o escondió información.",
      tipoFalta: "falta_no_grave",
    },
    POSIBLE_DELITO,
    NO_SEGURO,
  ],
  particular: [
    {
      clave: "ofrecio",
      etiqueta: "Ofreció dinero",
      ayuda: "Ofreció algo a cambio de conseguir un beneficio.",
      tipoFalta: "falta_particulares",
    },
    {
      clave: "empresa",
      etiqueta: "Era una empresa o negocio",
      ayuda: "Lo que pasó gira alrededor de un proveedor, contratista o representante.",
      tipoFalta: "falta_particulares",
    },
    {
      clave: "gestor",
      etiqueta: "Era un gestor o intermediario",
      ayuda: "Se presentó como alguien que podía conseguir o agilizar algo.",
      tipoFalta: "falta_particulares",
    },
    {
      clave: "ventaja",
      etiqueta: "Buscó una ventaja indebida",
      ayuda: "Intentó sacar provecho de un trámite, contrato o decisión pública.",
      tipoFalta: "falta_particulares",
    },
    POSIBLE_DELITO,
    NO_SEGURO,
  ],
};

export const senalesDe = (quien: Quien): readonly Senal[] => SENALES[quien];

export const sugerirTipoFalta = (
  quien: Quien,
  clave: string,
): { tipoFalta: TipoFalta; etiqueta: string } | null => {
  const senal = SENALES[quien].find((s) => s.clave === clave);
  if (!senal) return null;
  return { tipoFalta: senal.tipoFalta, etiqueta: TIPOS_FALTA[senal.tipoFalta].etiqueta };
};

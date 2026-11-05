/** Diccionario de los datos abiertos (HU-33). */
export const DICCIONARIO_DATOS = {
  descripcion:
    "Conteos de denuncias por trimestre cerrado, protegidos con k-anonimato. En este prototipo todas las denuncias son sintéticas.",
  licencia: "CC BY-NC, igual que el proyecto.",
  campos: [
    { campo: "periodo", tipo: "texto", descripcion: "Trimestre cerrado, como 2026-T3." },
    {
      campo: "tabla",
      tipo: "texto",
      descripcion:
        "Dimensiones de la fila, unidas con *. `total` es el total nacional del trimestre.",
    },
    { campo: "estado", tipo: "texto", descripcion: "Clave de entidad del Marco Geoestadístico." },
    {
      campo: "municipio",
      tipo: "texto",
      descripcion:
        "Clave de cinco dígitos: estado y municipio. Terminada en 999: denuncias del estado sin municipio.",
    },
    { campo: "tipoFalta", tipo: "texto", descripcion: "Clave del catálogo de tipos de falta." },
    { campo: "etapa", tipo: "texto", descripcion: "Etapa vigente en la fecha de corte." },
    {
      campo: "ente",
      tipo: "texto",
      descripcion:
        "Identificador del ente; los `ficticio-*` no corresponden a ninguna institución real. `sin_especificar`: la denuncia no indicó ente.",
    },
    {
      campo: "conteo",
      tipo: "entero o vacío",
      descripcion: "Número de denuncias. Vacío si la celda está oculta: el valor nunca se publica.",
    },
    {
      campo: "motivo",
      tipo: "texto",
      descripcion:
        "`publicada`; `menor_a_k`: hay entre 1 y k − 1; `supresion_complementaria`: se oculta para impedir deducir otra celda.",
    },
    { campo: "k", tipo: "entero", descripcion: "Umbral vigente al publicar el trimestre." },
    {
      campo: "datos_sinteticos",
      tipo: "booleano",
      descripcion: "`true` si las denuncias de origen provienen del generador sintético.",
    },
  ],
  notas: [
    "Un trimestre publicado no se recalcula.",
    "La etapa se toma en la fecha de corte: el cierre del trimestre más el rezago.",
    "Los conteos de la PDN por institución son otra fuente, real, y se consultan aparte.",
  ],
};

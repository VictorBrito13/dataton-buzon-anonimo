import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cómo te protegemos",
  description:
    "Qué guardamos, qué no guardamos, de qué te protege este buzón, de qué no, y cómo comprobarlo por tu cuenta.",
};

const REPOSITORIO = "https://github.com/VictorBrito13/dataton-buzon-anonimo";
const documento = (ruta: string) => `${REPOSITORIO}/blob/main/${ruta}`;

type Estado = "comprobado" | "pendiente";

/**
 * Cada afirmación lleva su estado real. Al integrar los frentes, pasa a "comprobado" solo lo que
 * `npm run test:anonimato` demuestre en docs/evidencia/reporte-anonimato.md.
 */
const COMPROBACIONES: { texto: string; estado: Estado }[] = [
  {
    texto: "Esta página y la de inicio no piden nada a otros dominios ni dejan cookies.",
    estado: "comprobado",
  },
  {
    texto: "El sitio envía las cabeceras de seguridad y no permite scripts incrustados.",
    estado: "comprobado",
  },
  {
    texto: "Los servidores no registran tu dirección IP ni tu navegador, ni siquiera al fallar.",
    estado: "comprobado",
  },
  {
    texto: "La base de datos no tiene ningún campo para dirección IP ni navegador.",
    estado: "comprobado",
  },
  { texto: "Tu frase y tu relato en claro nunca salen de tu dispositivo.", estado: "pendiente" },
  { texto: "Al enviar una denuncia no se pide nada a otros dominios.", estado: "pendiente" },
  {
    texto: "Tras enviar una denuncia, la base de datos no contiene tu relato, frase ni folio.",
    estado: "pendiente",
  },
  { texto: "Tus evidencias se limpian de datos ocultos.", estado: "pendiente" },
  { texto: "Las estadísticas públicas no muestran números pequeños.", estado: "pendiente" },
];

const ETIQUETA_ESTADO: Record<Estado, { texto: string; clase: string }> = {
  comprobado: { texto: "Comprobado", clase: "bg-exito-suave text-exito" },
  pendiente: { texto: "Pendiente de verificar", clase: "bg-aviso-suave text-aviso" },
};

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold">{titulo}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function Lista({ elementos }: { elementos: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-6">
      {elementos.map((elemento, indice) => (
        <li key={indice}>{elemento}</li>
      ))}
    </ul>
  );
}

function EnlaceExterno({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} rel="noreferrer" className="text-marca underline underline-offset-4">
      {children}
    </a>
  );
}

export default function ComoTeProtegemos() {
  return (
    <article className="max-w-3xl">
      <h1 className="text-3xl font-semibold">Cómo te protegemos</h1>
      <p className="mt-3 text-lg text-tinta-suave">
        No te pedimos que confíes en nuestra palabra. Aquí explicamos qué hacemos, dónde están los
        límites y cómo puedes revisarlo por tu cuenta.
      </p>

      <Seccion titulo="Qué guardamos">
        <Lista
          elementos={[
            "El estado y, si lo indicas, el municipio, el tipo de falta y la institución de tu denuncia.",
            "La etapa en la que va y el día en que cambió, sin la hora.",
            "Tu relato y tus evidencias, sellados: el servidor los guarda, pero solo la autoridad receptora puede abrirlos.",
            "Una huella de tu folio y otra de tu frase. Sirven para reconocerlos, no para recuperarlos.",
          ]}
        />
      </Seccion>

      <Seccion titulo="Qué no guardamos">
        <Lista
          elementos={[
            "Tu nombre, correo o teléfono: no te los pedimos.",
            "Tu dirección IP ni el tipo de navegador o de dispositivo que usas.",
            "Cookies que te sigan, ni herramientas de analítica o de publicidad.",
            "Tu frase de recuperación ni tu folio tal como los ves.",
            "La hora en que enviaste tu denuncia: solo el día.",
          ]}
        />
      </Seccion>

      <Seccion titulo="De qué te protege">
        <Lista
          elementos={[
            "De que quien administra el sistema lea tu relato: está sellado antes de salir de tu dispositivo.",
            "De que otras empresas sepan que visitaste este sitio: todo se sirve desde aquí, sin recursos de terceros.",
            "De que un archivo te delate: las evidencias se limpian de datos ocultos, como autor o ubicación.",
            "De que las estadísticas públicas te señalen: los números pequeños no se publican.",
          ]}
        />
      </Seccion>

      <Seccion titulo="De qué no te protege">
        <Lista
          elementos={[
            "De lo que tú mismo cuentes. Si describes algo que solo tú pudiste ver, o escribes de una forma reconocible, alguien podría deducir quién eres. Te avisamos de lo que detectamos, pero no podemos detectarlo todo.",
            "De que tu proveedor de internet o la red de tu trabajo sepan que entraste a este sitio. Pueden ver el sitio, no lo que escribes. Si te preocupa, usa otra red, por ejemplo Tor Browser.",
            "De que el momento en que envías se relacione con otro hecho que ya se conozca, como un conflicto reciente.",
            "De quien tenga tu frase o tu folio: con ellos puede ver el avance de tu denuncia. Guárdalos como guardarías una llave.",
            "De quien use tu mismo equipo. Si activas el borrador, queda en ese dispositivo. Si activas la detección de nombres, el navegador conserva el modelo, y eso muestra que usaste este sitio. En un equipo compartido, mejor no los actives.",
            "De un sitio alterado. Si alguien modifica el código que se te entrega, estas protecciones podrían dejar de funcionar. Por eso el código es público y se puede revisar.",
            "De la revisión de tus evidencias. Por un momento, el servidor las ve: las revisa, las sella y descarta el original. En esa etapa dependemos de que corra el código publicado.",
          ]}
        />
      </Seccion>

      <Seccion titulo="Cómo comprobarlo por tu cuenta">
        <p>
          En una computadora, abre las herramientas de desarrollo del navegador con la tecla F12.
        </p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>
            En la pestaña <strong>Red</strong>, recarga la página. Todas las peticiones deben ir a
            este mismo sitio, sin ningún otro dominio.
          </li>
          <li>
            En <strong>Aplicación</strong> o <strong>Almacenamiento</strong>, revisa las cookies y
            el almacenamiento local. Deben estar vacíos, salvo que hayas activado el borrador.
          </li>
          <li>
            Al enviar una denuncia de prueba, abre esa petición en la pestaña <strong>Red</strong>:
            no debe aparecer tu frase ni tu relato en claro.
          </li>
        </ol>
        <p>
          También puedes correr nuestras pruebas: la{" "}
          <EnlaceExterno href={documento("docs/guia-de-replica.md")}>guía de réplica</EnlaceExterno>{" "}
          explica cómo levantar el sistema en tu equipo. Consulta también el{" "}
          <EnlaceExterno href={documento("docs/modelo-de-amenazas.md")}>
            modelo de amenazas
          </EnlaceExterno>
          , el{" "}
          <EnlaceExterno href={documento("docs/evidencia/reporte-anonimato.md")}>
            último reporte de pruebas
          </EnlaceExterno>{" "}
          y el <EnlaceExterno href={REPOSITORIO}>código fuente</EnlaceExterno>.
        </p>
      </Seccion>

      <Seccion titulo="Qué hemos comprobado hasta ahora">
        <p>
          Esto es un prototipo en desarrollo. Lo marcamos como comprobado solo cuando una prueba
          automática lo demuestra.
        </p>
        <ul className="space-y-3">
          {COMPROBACIONES.map(({ texto, estado }) => (
            <li
              key={texto}
              className="flex flex-col items-start gap-2 rounded border border-borde bg-superficie p-3 sm:flex-row sm:justify-between"
            >
              <span>{texto}</span>
              <span
                className={`shrink-0 rounded px-2 py-0.5 text-sm font-medium ${ETIQUETA_ESTADO[estado].clase}`}
              >
                {ETIQUETA_ESTADO[estado].texto}
              </span>
            </li>
          ))}
        </ul>
      </Seccion>
    </article>
  );
}

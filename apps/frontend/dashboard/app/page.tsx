import Link from "next/link";
import { SimboloLogo } from "@/components/logo";
import { ProcesoDespues } from "@/components/proceso-despues";

const PASOS = [
  {
    titulo: "Cuenta qué pasó",
    texto:
      "Eliges el estado y escribes lo que viste. Si no sabes cómo se llama la falta, te ayudamos a orientarte.",
  },
  {
    titulo: "Agrega personas y evidencias, si las tienes",
    texto: "Las dos cosas son opcionales. A tus archivos les quitamos datos ocultos, como el GPS.",
  },
  {
    titulo: "Revisa tu texto",
    texto:
      "Tu dispositivo busca datos que podrían identificarte y te sugiere cambiarlos. Tú decides.",
  },
  {
    titulo: "Guarda tu frase de 6 palabras",
    texto: "Es tu llave para volver. No la podemos recuperar por ti.",
  },
  {
    titulo: "Envía y recibe tu folio",
    texto: "Con el folio o con la frase puedes ver el avance y responderle a la autoridad.",
  },
];

const VISIBILIDAD = [
  {
    dato: "Tu relato y las personas que menciones",
    autoridad: "Sí",
    detalle: "Se sella en tu dispositivo. Solo la autoridad puede abrirlo; este sistema no.",
  },
  {
    dato: "Tus evidencias",
    autoridad: "Sí",
    detalle:
      "Sin los datos ocultos que logramos quitar. El servidor las revisa antes de sellarlas, así que en ese momento las ve.",
  },
  {
    dato: "Estado, municipio, tipo de falta e institución",
    autoridad: "Sí",
    detalle: "Van sin sellar. El tablero público solo los muestra como conteos agrupados.",
  },
  {
    dato: "Tu nombre, correo o teléfono",
    autoridad: "No",
    detalle: "No te los pedimos. Solo aparecerían si tú los escribes.",
  },
  {
    dato: "Tu dirección IP y tu navegador",
    autoridad: "No",
    detalle: "No se guardan junto a tu denuncia.",
  },
  {
    dato: "La hora en que denunciaste",
    autoridad: "No",
    detalle:
      "Solo se guarda el día. Una copia física de la base podría acotar el orden de llegada y la hora aproximada.",
  },
  {
    dato: "Tu frase de 6 palabras",
    autoridad: "No",
    detalle: "Nunca sale de tu dispositivo.",
  },
];

const GARANTIAS = [
  { titulo: "Sin cuenta, correo ni teléfono", texto: "No te pedimos nada que diga quién eres." },
  {
    titulo: "Tu relato se sella en tu dispositivo",
    texto: "Solo la autoridad puede abrirlo; este sistema no.",
  },
  { titulo: "Tu frase nunca sale de tu dispositivo", texto: "Es tu llave para volver." },
  {
    titulo: "Solo se guarda el día",
    texto:
      "No la hora en que denunciaste. Solo una copia física de la base dejaría acotarla de forma aproximada.",
  },
];

export default function Inicio() {
  return (
    <div className="space-y-14 lg:space-y-20">
      <section className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <div>
          <h1 className="max-w-3xl text-4xl leading-tight font-bold text-balance sm:text-5xl xl:text-6xl">
            Denuncia corrupción sin dar tu nombre
          </h1>
          <p className="mt-4 max-w-2xl text-xl">
            No necesitas cuenta, correo ni teléfono. Solo tienes que contar lo que pasó, y después
            puedes ver el avance de tu denuncia.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              prefetch={false}
              href="/denunciar"
              className="inline-flex min-h-12 items-center justify-center rounded-sm bg-marca px-6 py-3 text-center text-lg font-semibold text-marca-tinta no-underline hover:underline"
            >
              Hacer una denuncia
            </Link>
            <Link
              prefetch={false}
              href="/seguimiento"
              className="inline-flex min-h-12 items-center justify-center rounded-sm border border-borde-fuerte bg-superficie px-6 py-3 text-center text-lg font-medium text-tinta no-underline hover:bg-marca-suave"
            >
              Ver una denuncia que ya hice
            </Link>
          </div>
          <p className="mt-5 max-w-2xl text-tinta-suave">
            Si alguien se acerca, usa «Salida rápida», arriba, o pulsa Esc tres veces. Te lleva a
            Google, un sitio ajeno que recibe tu IP y la hora como cualquier página que abras, y
            antes borra el borrador y el tema que este sitio guardó. No borra el historial del
            navegador ni el modelo de detección de nombres, si lo activaste.
          </p>
        </div>

        <aside
          aria-label="Lo esencial sobre tu anonimato"
          className="rounded-md border border-borde bg-superficie p-5 sm:p-6"
        >
          <div className="flex items-center gap-4">
            <SimboloLogo className="size-14 sm:size-16" />
            <p className="text-lg leading-snug font-semibold">
              Un buzón que no necesita saber quién eres
            </p>
          </div>
          <ul className="mt-5 divide-y divide-borde">
            {GARANTIAS.map((garantia) => (
              <li key={garantia.titulo} className="py-3 last:pb-0">
                <p className="font-semibold">{garantia.titulo}</p>
                <p className="text-tinta-suave">{garantia.texto}</p>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <section aria-labelledby="pasos">
        <h2 id="pasos" className="text-2xl font-semibold">
          Cómo se hace
        </h2>
        <ol className="mt-4 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {PASOS.map((paso, i) => (
            <li
              key={paso.titulo}
              className="flex gap-4 border-t border-borde py-4 xl:flex-col xl:gap-2"
            >
              <span aria-hidden="true" className="w-8 shrink-0 text-3xl font-bold text-marca">
                {i + 1}
              </span>
              <div>
                <h3 className="font-semibold">{paso.titulo}</h3>
                <p>{paso.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="grid grid-cols-1 gap-14 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-12">
        <section aria-labelledby="que-ve">
          <h2 id="que-ve" className="text-2xl font-semibold">
            Qué ve y qué no ve la autoridad
          </h2>
          <div role="region" aria-labelledby="que-ve" tabIndex={0} className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">
                Qué datos de tu denuncia puede ver la autoridad y cuáles no
              </caption>
              <thead>
                <tr className="border-b-2 border-borde-fuerte">
                  <th scope="col" className="py-2 pr-3">
                    Dato
                  </th>
                  <th scope="col" className="py-2 pr-3 whitespace-nowrap">
                    ¿Lo ve?
                  </th>
                  <th scope="col" className="hidden py-2 sm:table-cell">
                    Detalle
                  </th>
                </tr>
              </thead>
              <tbody>
                {VISIBILIDAD.map((fila) => (
                  <tr key={fila.dato} className="border-b border-borde align-top">
                    <th scope="row" className="py-3 pr-3 font-normal">
                      <span className="font-medium">{fila.dato}</span>
                      <span className="mt-1 block text-tinta-suave sm:hidden">{fila.detalle}</span>
                    </th>
                    <td className="py-3 pr-3 font-semibold">{fila.autoridad}</td>
                    <td className="hidden py-3 text-tinta-suave sm:table-cell">{fila.detalle}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          aria-labelledby="limite"
          className="max-w-3xl self-start border-l-4 border-aviso pl-4"
        >
          <h2 id="limite" className="text-2xl font-semibold">
            Lo que no podemos evitar
          </h2>
          <p className="mt-2">
            <strong>Lo que tú escribas puede identificarte.</strong> Si cuentas algo que solo tú
            pudiste ver, alguien podría deducir quién eres, aunque no des tu nombre. Te avisamos de
            lo que detectamos, pero ninguna herramienta lo encuentra todo.
          </p>
          <p className="mt-2">
            Tampoco podemos protegerte de quien vea tu pantalla o use tu dispositivo. Si es un
            equipo compartido o del trabajo, mejor usa otro.
          </p>
        </section>
      </div>

      <ProcesoDespues />
    </div>
  );
}

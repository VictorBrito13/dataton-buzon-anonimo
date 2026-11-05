import Link from "next/link";
import { SalidaRapida } from "@/components/salida-rapida";

const ENLACES = [
  { href: "/denunciar", texto: "Denunciar" },
  { href: "/seguimiento", texto: "Seguimiento" },
  { href: "/tablero", texto: "Tablero público" },
  { href: "/como-te-protegemos", texto: "Cómo te protegemos" },
];

/** La franja con la salida rápida queda fija al desplazarse; la navegación no ocupa pantalla en el celular. */
export function SiteHeader() {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2">
          <Link
            prefetch={false}
            href="/"
            className="inline-flex min-h-11 items-center font-semibold text-tinta no-underline"
          >
            Buzón Anónimo
          </Link>
          <SalidaRapida />
        </div>
      </header>
      <nav aria-label="Principal" className="border-b border-borde bg-superficie">
        <ul className="mx-auto flex max-w-5xl flex-wrap gap-x-5 px-4 text-sm">
          {ENLACES.map((enlace) => (
            <li key={enlace.href}>
              <Link
                prefetch={false}
                href={enlace.href}
                className="inline-flex min-h-11 items-center text-tinta underline-offset-4 hover:underline"
              >
                {enlace.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

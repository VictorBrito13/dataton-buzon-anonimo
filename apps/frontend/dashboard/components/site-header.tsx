import Link from "next/link";
import { Logo } from "@/components/logo";
import { SalidaRapida } from "@/components/salida-rapida";
import { SelectorTema } from "@/components/selector-tema";

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
      <header className="encabezado-fijo sticky top-0 z-10 border-b border-borde bg-superficie">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 sm:gap-x-3">
          <Link
            prefetch={false}
            href="/"
            className="mr-auto inline-flex min-h-11 items-center text-tinta no-underline"
          >
            <Logo />
          </Link>
          <SelectorTema />
          <SalidaRapida />
        </div>
      </header>
      <nav aria-label="Principal" className="border-b border-borde bg-superficie">
        <ul className="mx-auto grid max-w-7xl grid-cols-[repeat(auto-fit,minmax(8.25rem,1fr))] gap-x-3 px-4 text-sm sm:flex sm:flex-wrap sm:gap-x-6">
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

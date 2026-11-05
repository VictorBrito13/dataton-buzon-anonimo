import Link from "next/link";

const ENLACES = [
  { href: "/denunciar", texto: "Denunciar" },
  { href: "/seguimiento", texto: "Seguimiento" },
  { href: "/tablero", texto: "Tablero público" },
  { href: "/como-te-protegemos", texto: "Cómo te protegemos" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-borde bg-superficie">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-semibold text-tinta no-underline">
          Buzón Anónimo
        </Link>
        <nav aria-label="Principal">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {ENLACES.map((enlace) => (
              <li key={enlace.href}>
                <Link href={enlace.href} className="text-tinta underline-offset-4 hover:underline">
                  {enlace.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

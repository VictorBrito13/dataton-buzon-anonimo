const NO_EXISTEN = [
  { dato: "Dirección IP", detalle: "no se guarda junto a ninguna denuncia" },
  { dato: "Correo o teléfono", detalle: "no se piden: no hay cuentas para denunciar" },
  {
    dato: "Dispositivo o navegador",
    detalle: "no se guarda; de cada acción solo se conserva el día",
  },
];

/** Es parte de la demostración: quien tramita ve lo que no tiene, no solo lo que tiene. */
export function RecuadroSinDatos() {
  return (
    <aside
      aria-labelledby="titulo-sin-datos"
      className="rounded-sm border-2 border-marca bg-marca-suave p-4 text-sm text-tinta"
    >
      <h2 id="titulo-sin-datos" className="font-semibold">
        Lo que no existe en este sistema sobre quien denuncia
      </h2>
      <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-3">
        {NO_EXISTEN.map(({ dato, detalle }) => (
          <li key={dato}>
            <strong>{dato}:</strong> {detalle}.
          </li>
        ))}
      </ul>
      <p className="mt-2">
        El relato y los mensajes de quien denuncia se abren aquí, en este navegador, con su clave
        privada; el servidor no la tiene. Límite: las evidencias pasan por el servidor mientras las
        verifica, antes de sellarlas.
      </p>
    </aside>
  );
}

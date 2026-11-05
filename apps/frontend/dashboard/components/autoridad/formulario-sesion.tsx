"use client";

import { useState, type FormEvent } from "react";
import { ErrorApi } from "@/lib/api";
import { iniciarSesion, mensajeDeError } from "@/lib/autoridad/api";
import { usePanel } from "./contexto";
import { ALERTA, BOTON_PRIMARIO, CAMPO, ETIQUETA, SECCION } from "./estilos";

export function FormularioSesion() {
  const { marcarActiva } = usePanel();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      await iniciarSesion({ usuario, contrasena });
      marcarActiva();
    } catch (causa) {
      setContrasena("");
      setError(
        causa instanceof ErrorApi && causa.estado === 401
          ? "Usuario o contraseña incorrectos."
          : mensajeDeError(causa),
      );
      setEnviando(false);
    }
  };

  return (
    <section className="max-w-sm">
      <h1 className="mb-3 text-2xl font-semibold">Panel de la autoridad receptora</h1>
      <form onSubmit={enviar} className={`${SECCION} space-y-3`}>
        <div>
          <label htmlFor="usuario" className={ETIQUETA}>
            Usuario
          </label>
          <input
            id="usuario"
            className={CAMPO}
            autoComplete="username"
            required
            maxLength={100}
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="contrasena" className={ETIQUETA}>
            Contraseña
          </label>
          <input
            id="contrasena"
            type="password"
            className={CAMPO}
            autoComplete="current-password"
            required
            maxLength={200}
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className={ALERTA}>
            {error}
          </p>
        )}
        <button type="submit" className={BOTON_PRIMARIO} disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </section>
  );
}

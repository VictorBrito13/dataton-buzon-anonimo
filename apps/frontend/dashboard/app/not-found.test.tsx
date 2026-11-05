// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import NotFound, { metadata } from "./not-found";

describe("página 404", () => {
  const html = renderToStaticMarkup(<NotFound />);

  it("está en español y tiene un título principal", () => {
    expect(html).toMatch(/<h1[^>]*>No encontramos esta página<\/h1>/);
    expect(html).not.toMatch(/could not be found/i);
    expect(metadata.title).toBe("Página no encontrada");
  });

  it("enlaza al inicio", () => {
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Volver al inicio<\/a>/);
  });

  it("usa los tokens del tema y ningún estilo en línea, que la CSP bloquearía", () => {
    expect(html).toContain("bg-marca");
    expect(html).toContain("text-marca-tinta");
    expect(html).not.toContain("style=");
  });
});

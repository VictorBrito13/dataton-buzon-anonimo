/**
 * La migración 200 crea el rol de la API pública con una contraseña de desarrollo que está en el
 * repositorio. Tras migrar, el despliegue la reemplaza por la generada en el volumen de secretos.
 */
import pg from "pg";

const contrasena = new URL(process.env.DATABASE_URL_PUBLICO).password;
const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL });

await cliente.connect();
try {
  const literal = cliente.escapeLiteral(contrasena);
  await cliente.query(`ALTER ROLE buzon_lector_publico PASSWORD ${literal}`);
  console.log("[migraciones] contraseña del rol de lectura pública actualizada");
} finally {
  await cliente.end();
}

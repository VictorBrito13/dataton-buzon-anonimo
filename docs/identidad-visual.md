# Identidad visual

## Logotipo

**Concepto: una persona sin rostro cuyo cuerpo es un sobre.** Quien denuncia se vuelve su mensaje: se
lee lo que dice, no quién lo dice. El recuadro redondeado es la puerta del buzón.

- Son cuatro formas: recuadro, cabeza, sobre y solapa. Sigue siendo legible a 16 px.
- La silueta no tiene rasgos ni señas: no representa a nadie en particular.
- No usa candados ni escudos, y no imita símbolos oficiales del gobierno mexicano ni de la SESNA.
- Dibujado a mano en SVG, sin herramientas externas ni recursos de terceros.

### Licencia

El logotipo y sus variantes se publican bajo
[Creative Commons Atribución-NoComercial 4.0 Internacional (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/deed.es),
atribuidos al proyecto Buzón Anónimo.

### Archivos

| Archivo                                                       | Uso                                                 |
| ------------------------------------------------------------- | --------------------------------------------------- |
| `apps/frontend/dashboard/app/icon.svg`                        | Fuente del trazo. Cambia con el tema del navegador. |
| `apps/frontend/dashboard/app/favicon.ico`                     | Navegadores antiguos: 16, 32 y 48 px.               |
| `apps/frontend/dashboard/app/apple-icon.png`                  | Pantalla de inicio de iOS: 180 px, a sangre.        |
| `apps/frontend/dashboard/public/iconos/icono-192.png`, `-512` | Manifiesto web.                                     |
| `apps/frontend/dashboard/public/iconos/icono-mascara-512.png` | Icono adaptable de Android.                         |
| `apps/frontend/dashboard/components/logo.tsx`                 | Encabezado e inicio. Usa los tokens del tema.       |

Los binarios se regeneran desde `icon.svg` con
`node apps/frontend/dashboard/scripts/generar-iconos.mjs`.

### Variantes

| Variante | Recuadro  | Figura    | Uso                                              |
| -------- | --------- | --------- | ------------------------------------------------ |
| Clara    | `#0b5563` | `#f7f5f0` | Fondos claros, y siempre en los iconos binarios. |
| Oscura   | `#7fd0de` | `#11181f` | Fondos oscuros.                                  |

Conserva "Buzón Anónimo" como texto real junto al símbolo: el SVG es decorativo para los lectores de
pantalla. Deja alrededor un margen de al menos un cuarto del lado del símbolo y no lo deformes.

## Paleta

Los tokens viven en `apps/frontend/dashboard/app/globals.css`.

| Token             | Claro     | Oscuro    | Uso                         |
| ----------------- | --------- | --------- | --------------------------- |
| `--papel`         | `#f7f5f0` | `#11181f` | Fondo de página             |
| `--superficie`    | `#ffffff` | `#1a232c` | Paneles y controles         |
| `--tinta`         | `#1b2733` | `#eef1f3` | Texto                       |
| `--tinta-suave`   | `#4c5a67` | `#b3bec8` | Texto secundario            |
| `--borde`         | `#d6d2c8` | `#36424e` | Separadores                 |
| `--borde-fuerte`  | `#7b8691` | `#84919d` | Contorno de controles       |
| `--marca`         | `#0b5563` | `#7fd0de` | Verde azulado: marca y foco |
| `--marca-tinta`   | `#ffffff` | `#0a2228` | Texto sobre la marca        |
| `--marca-suave`   | `#dcecef` | `#143840` | Fondo de realce             |
| `--aviso`         | `#8a4b00` | `#f3c17b` | Advertencias                |
| `--aviso-suave`   | `#fbeed9` | `#3b2a12` | Fondo de advertencias       |
| `--peligro`       | `#a3241d` | `#f5a29c` | Errores y salida rápida     |
| `--peligro-suave` | `#fae3e1` | `#431b18` | Fondo de errores            |
| `--exito`         | `#1f6b3a` | `#8fd8a8` | Confirmaciones y datos PDN  |
| `--exito-suave`   | `#dff1e5` | `#16321f` | Fondo de confirmaciones     |

Tipografía: solo fuentes del sistema (decisión D7).

## Tema claro, oscuro y automático

- La preferencia se guarda en `localStorage` con la clave `buzon:tema`, y la salida rápida la borra.
- Solo se escribe al elegir claro u oscuro. «Automático» es el valor por omisión y no deja rastro.
- Un script en `<head>`, con el nonce de la CSP, marca `<html data-tema>` antes de pintar. Sin
  JavaScript no hay marca y manda `prefers-color-scheme`.
- La lógica pura y sus pruebas están en `apps/frontend/dashboard/lib/tema/`.

## Diseño adaptable

`apps/frontend/dashboard/e2e/responsive.spec.ts` recorre las páginas a 320, 360, 390, 768, 1024, 1440
y 1920 px, en horizontal a 844×390 y con texto al 200 %. Falla si hay desplazamiento lateral, un
objetivo táctil menor a 44 px o una tabla ancha sin región desplazable.

Con el texto al 200 % en un celular, el encabezado deja de ser fijo para no tapar media pantalla y la
salida rápida queda en la esquina inferior derecha.

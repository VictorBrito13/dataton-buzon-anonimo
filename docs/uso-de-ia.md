# Declaración de uso de inteligencia artificial

Esta declaración atiende la base Sexta de la convocatoria, que pide declarar el uso de herramientas de inteligencia artificial, su finalidad y su alcance. **Es la fuente oficial sobre el uso de IA en este proyecto.**

## Resumen

| Herramienta                        | Dónde se usa          | Finalidad                                       | ¿Forma parte del producto? | Estado                 |
| ---------------------------------- | --------------------- | ----------------------------------------------- | -------------------------- | ---------------------- |
| Claude Code (Anthropic)            | Desarrollo            | Asistencia en código, pruebas y documentación   | No                         | En uso                 |
| Modelo NER local en el navegador   | Revisión de `/denunciar` | Sugerir nombres, lugares y organizaciones para redactar | Sí, opcional               | Integrado              |

El **orientador de faltas no usa IA**: funciona con reglas locales y catálogos, y su resultado es solo una orientación.

## 1. Asistencia en el desarrollo: Claude Code

**Herramienta.** Claude Code, asistente de programación de Anthropic.

**Finalidad.** Acelerar la escritura de código, pruebas automatizadas, configuración de infraestructura y documentación, incluidos este documento y el modelo de amenazas.

**Alcance.** Se usó a lo largo del desarrollo y de la documentación, en todos los módulos.

**Revisión humana.** El equipo define el problema, toma las decisiones de diseño y revisa los cambios antes de integrarlos. La responsabilidad por el resultado es del equipo.

**Lo que no hace.**

- No forma parte del sistema desplegado: el producto no llama a Claude ni a otro servicio de IA externo.
- No recibe denuncias: el proyecto solo usa datos sintéticos.

**Historial de commits.** Los commits y los pull requests del repositorio **no llevan marcas de coautoría de IA**. Que un commit no mencione a la IA no significa que se haya escrito sin asistencia; **esta declaración es la que informa de ese uso**.

## 2. En el producto: modelo NER local

**Estado: integrado** en el paso de revisión de `/denunciar`, como la opción «Buscar también nombres, cargos y lugares», apagada por defecto. El modelo es `Xenova/distilbert-base-multilingual-cased-ner-hrl` (revisión `c2a4dbf`, cuantizado, licencia Academic Free License 3.0; ver [`AVISOS-TERCEROS.md`](../AVISOS-TERCEROS.md)); su peso y sus límites están en el [README de la librería de privacidad](../apps/frontend/dashboard/lib/privacidad/README.md#capa-2-modelo). Se sirve desde el propio sitio cuando la imagen se construye con `DESCARGAR_MODELO_NER=1` (el valor por defecto); sin él, la opción lo dice y el depurador sigue con reglas.

**Finalidad.** Sugerir nombres de personas, lugares y organizaciones que convenga redactar del relato (HU-15).

**Alcance.**

- Corre en el navegador de la persona, y solo si la persona lo activa.
- Solo sugiere: la persona decide qué redactar.
- Sus archivos se sirven desde el mismo sitio. La descarga desde su origen ocurre al construir la imagen, no en el dispositivo.
- Comprobado con el modelo real en `apps/frontend/dashboard/e2e/busqueda-modelo.spec.ts`: durante el análisis ninguna petición sale a otro dominio y el relato no aparece en el tráfico; sin activar la opción no se pide ningún archivo del modelo.

**Límites.** Su precisión no se ha medido con denuncias ni con nombres mexicanos, y puede omitir nombres o confundir otros. Se ofrece como ayuda, no como garantía. Al usarlo, queda en la caché del navegador.

## 3. Lo que no usa IA

- **Orientador de faltas:** reglas locales sobre los catálogos.
- **Depurador por reglas:** expresiones regulares para CURP, RFC, teléfonos, correos, CLABE y placas.
- **Motor de k-anonimato e indicadores:** reglas deterministas y públicas.
- **Decisiones sobre denuncias:** el sistema no evalúa, clasifica de forma definitiva ni prioriza denuncias individuales con IA.

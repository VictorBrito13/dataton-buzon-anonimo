# Buzón anónimo de denuncias con transparencia pública del seguimiento

---

## 1. Idea general

Un buzón de denuncias pensado **primero para proteger a quien denuncia** y, en segundo lugar, para que la ciudadanía pueda **ver si las entidades realmente dan seguimiento** a las denuncias.

Parte del prototipo de buzón anónimo que presentó la SESNA y se concentra en tres cosas: **anonimato verificable, seguridad y experiencia de usuario**. Además agrega una capa de **transparencia pública** con estadísticas protegidas por k-anonimato.

## 2. Problema que resuelve

| Problema | Consecuencia |
|---|---|
| Miedo a represalias al denunciar | Se denuncia menos o se abandona el proceso |
| El anonimato se rompe por detalles técnicos (IP, captchas de terceros, metadatos, texto que identifica) | Una denuncia "anónima" puede acabar identificando a la persona |
| Formularios largos y poco claros | Abandono y denuncias incompletas o mal dirigidas |
| No se sabe qué pasó con la denuncia | Desconfianza en el sistema |
| No hay forma pública de ver si las entidades atienden las denuncias | Falta de rendición de cuentas |

## 3. Propuesta

1. **Denunciar sin cuenta**: sin correo, teléfono ni registro. El acceso y el seguimiento se hacen con un folio y una **frase de recuperación** en caso de que se olvide el folio.
2. **Depuración local del contenido**: el navegador detecta y sugiere eliminar datos que puedan identificar al denunciante, sin enviar nada al servidor.
3. **Evidencias sin metadatos**, limpiadas en el dispositivo y verificadas de nuevo en el servidor.
4. **Seguimiento claro del estatus** con el mismo folio.
5. **Tablero público** con estadísticas por estado, municipio, tipo de falta y estatus, protegido con **umbral k**.
6. **Indicadores por ente** para ver si dan seguimiento a las denuncias.

## 4. Funcionalidades

### 4.1 Para quien denuncia

- **Landing** con los pasos para denunciar, en lenguaje claro y diseñada primero para celular.
- **Formulario por pasos**: hechos, personas o entes involucrados, evidencias, revisión final.
- **Borrador guardado solo en el dispositivo** (almacenamiento local), para no perder lo escrito. No viaja al servidor.
- **Frase de recuperación de 6 palabras** en español. Se puede copiar, imprimir o guardar como QR.
  - El servidor **no guarda la frase**: guarda solo un identificador derivado mediante una función de derivación de claves (Frase generada tiene un ID que se guarda en el servidor).
  - Límite de intentos y mensajes de error uniformes, para no revelar si un folio existe.
- **Depurador local de identificadores**:
  - Capa 1 (siempre activa): reglas y expresiones regulares para CURP, RFC, teléfonos, correos, CLABE, placas.
  - Capa 2 (opcional): modelo NER en español que corre en el navegador (Transformers.js u ONNX Runtime Web) para nombres, cargos y lugares (Depurador basado en Procesadores de lenguaje natural).
  - Capa 3: avisos de riesgo contextual (fechas exactas, "el único que...").
  - La persona decide qué redactar. El texto nunca sale del dispositivo durante este análisis.
- **Limpieza de metadatos** (EXIF, autor, GPS, propiedades de PDF y Office) en el navegador antes de subir, con verificación adicional en el servidor.
- Aviso claro de qué ve y qué no ve la autoridad.
- **Línea de tiempo del estatus** en lenguaje claro.
- **Accesibilidad** conforme a WCAG 2.0 AA, con evidencia de pruebas.

### 4.2 Para el público

- **Mapa nacional** de denuncias con niveles nacional, estatal y municipal.
- **Estadísticas** por tipo de falta y estatus (ver sección 7).
- **Indicadores por ente** (si el S5 expone los datos necesarios):
  - porcentaje de denuncias con respuesta;
  - tiempo promedio por etapa;
  - porcentaje turnado a investigación, archivado o sin competencia.
- **Datos abiertos** en formato descargable (CSV y JSON) con los agregados ya protegidos.

### 4.3 Para la autoridad receptora

- Vista de las denuncias recibidas sin datos del denunciante.
- Canal para responder al denunciante mediante el folio, sin conocer su identidad.
- Registro de accesos y acciones.

## 5. Diferenciadores frente al prototipo de la SESNA
"No visto" significa que no pude ver si el prototipo contaba con el aspecto, no que no lo tenga, quizas si cubre el aspecto, quizas no.

| Aspecto | Prototipo SESNA (lo observado) | Nuestra propuesta |
|---|---|---|
| Acceso con folio | Sí | Sí, con **frase de 6 palabras recuperable**, derivación de clave y límite de intentos |
| Limpieza de metadatos | Probable | En el dispositivo **y** verificación en el servidor, con evidencia de pruebas |
| Depurador de identificadores en el texto | No visto | **Sí, local en el navegador**, por capas |
| Seguimiento público con umbral k | No visto | **Sí**, con supresión y agregación jerárquica |
| Indicadores de desempeño por ente | No visto | **Sí**, si el S5 expone los datos |
| Modelo de amenazas documentado | No visto | **Sí**, público y con pruebas |
| Captchas y scripts de terceros | No visto | **Ninguno**: prueba de trabajo autoalojada y todo el código servido localmente |
| Bitácoras con IP y analítica | No visto | **Sin IP, sin analítica**, marcas de tiempo redondeadas |
| Borrador y formulario por pasos | Sí | Sí, con borrador solo local |
| Accesibilidad con evidencia | Sin confirmar | Sí, con auditoría documentada |

**En una frase:** nuestro diferenciador es que el anonimato no se afirma, se **demuestra** (modelo de amenazas y pruebas) y que además agrega **transparencia pública** del seguimiento.

## 6. Seguridad y privacidad

### 6.1 Principios

- **Minimizar**: no recolectar lo que no se necesita.
- **Local primero**: el análisis del texto y la limpieza de archivos ocurren en el dispositivo.
- **Sin terceros**: ningún script, fuente, captcha o analítica externa.
- **Verificable**: código abierto, documentación y pruebas públicas.

### 6.2 Medidas

- HTTPS con HSTS, política CSP restrictiva y cookies mínimas o nulas.
- Sin registro de IP ni user-agent. Marcas de tiempo redondeadas.
- Evidencias validadas por tipo, escaneadas contra malware y cifradas en reposo.
- Captcha sustituido por **prueba de trabajo autoalojada** (por ejemplo Altcha).
- Mensajes de error uniformes y límite de intentos en el acceso por frase.
- Compatibilidad con Tor (sitio .onion opcional como mejora futura).

### 6.3 Modelo de amenazas (resumen; se desarrollará en un documento aparte)

| Quién podría identificar | Cómo | Mitigación |
|---|---|---|
| El propio sistema o su operador | IP, bitácoras, cookies | No se guardan; sin analítica |
| Un tercero que observa el tráfico | Dominios de terceros, captchas | Sin recursos externos; HTTPS |
| La entidad denunciada | Metadatos, estilo de redacción, detalles únicos | Limpieza de archivos, depurador, avisos de riesgo |
| Alguien que obtiene la frase | Robo o descuido | Instrucciones de resguardo, límite de intentos |
| Análisis de las estadísticas públicas | Conteos pequeños por municipio | Umbral k (sección 7) |

**Límite honesto:** ninguna herramienta puede impedir que una persona se identifique por el propio contenido de su denuncia (por ejemplo, si describe algo que solo ella pudo presenciar). Por eso el sistema **avisa del riesgo** pero no lo garantiza.

## 7. Estadísticas públicas y k-anonimato

### 7.1 Qué se publica

Conteos de denuncias por **estado, municipio, tipo de falta y estatus**, y los indicadores por ente.

### 7.2 Riesgo

En un municipio pequeño, "1 denuncia en etapa de investigación" puede identificar a la persona denunciante o permitir inferirla. Además, si se publican totales y subtotales, una celda oculta se puede recuperar **restando**.

Ejemplo de inferencia

| Municipio |	Cohecho	| Abuso de autoridad | Total del municipio |
|---|---|---|---|
| A | 23 | 41 | 64 |
| B | 12 | 9 | 21 |
| C | < 5 | 8 | 9 |

Cualquiera puede calcular: 9 − 8 = 1. La celda “< 5” de cohecho en el municipio C es exactamente 1 denuncia. El total revela lo que la celda ocultaba.
Con el valor exacto en mano, el atacante cruza información que ya tiene. Ejemplo:

El tablero muestra, para el municipio C, 1 denuncia de cohecho en etapa de investigación.
El atacante sabe que en ese municipio hay solo una dependencia pequeña, por ejemplo la dirección de obras públicas, con 12 empleados.
Sabe que hace dos semanas hubo un conflicto por un contrato de obra.
El tablero se actualizó justo después de ese conflicto.
Concluye que alguien de esa dirección denunció, y que probablemente fue quien tuvo ese conflicto.

### 7.3 Cómo funciona

1. **Umbral k** (propuesta inicial: **k = 5**). Una celda con menos de k denuncias no se muestra con su valor: aparece como "< 5".
2. **Agregación jerárquica**: si un municipio no alcanza k, sus datos se **suben de nivel** (municipio → estado → nacional) y ahí se publican.
3. **Supresión complementaria**: si ocultar una celda permitiría deducirla por resta con un total publicado, se oculta también otra celda relacionada (se oculta la celda del total para municipio C).
4. **Límite de cruces**: se publican como máximo **dos dimensiones a la vez** (por ejemplo municipio × tipo, pero no municipio × tipo × estatus).
5. **Ventanas de tiempo y rezago**: datos por trimestre y con unas semanas de retraso, para que la aparición de un caso nuevo no se pueda ligar a un hecho reciente.
6. **Nunca se publica** nada sobre la persona denunciada ni datos que permitan reconstruirla (presunción de inocencia).

### 7.4 Ejemplo

| Municipio | Cohecho | Abuso de autoridad | Otros |
|---|---|---|---|
| A (grande) | 23 | 41 | 18 |
| B (mediano) | 7 | 6 | < 5 |
| C (pequeño) | < 5 | < 5 | < 5 |

Los casos de C no desaparecen: se suman en el **total estatal** y se publican ahí.

### 7.5 Pendientes de definir

- Valor final de k (5, 10 u otro) según el volumen real de denuncias.
- Lista de **tipos de falta**: parte de la clasificación de faltas administrativas (graves, no graves y de particulares) y se ajusta a lo que permita la API del S5.
- Qué campos y fechas expone realmente el S5 para calcular los indicadores por ente.

## 8. Relación con el S5 y con otras autoridades

El flujo habitual en los órganos internos de control es: recepción → turno a la autoridad investigadora → análisis de competencia → investigación o turno a la autoridad competente → si hay presunta responsabilidad, pase a la autoridad substanciadora y al Tribunal de Justicia Administrativa.

Nuestro seguimiento mostrará esas etapas como una **línea de tiempo** al denunciante. **Por confirmar**: qué etapas y fechas expone la API del S5.

## 9. Cumplimiento de criterios de evaluación

| # | Criterio | Cómo lo atendemos |
|---|---|---|
| 1 | Confidencialidad y protección de la identidad | Acceso por frase, depurador local, limpieza de metadatos, sin IP ni terceros, modelo de amenazas |
| 2 | Valor público en el combate a la corrupción | Seguimiento público de entes, mapa e indicadores de desempeño |
| 3 | Funcionalidad técnica y operativa | Prototipo funcional sobre la versión de pruebas del S5 y datos sintéticos |
| 4 | Explotación y reutilización de datos de la PDN | Uso del S5 y generación de nuevos conjuntos de datos abiertos anonimizados |
| 5 | Experiencia de usuario y accesibilidad | Formulario por pasos, móvil primero, WCAG AA, lenguaje claro, salida rápida |
| 6 | Creatividad e innovación | Depurador local, frase de recuperación, k-anonimato aplicado a denuncias |
| 7 | Calidad de la presentación | Demo del flujo completo y comparación de antes y después en privacidad |
| 8 | Calidad de la documentación | Documentación técnica, modelo de amenazas, guía de réplica |

## 10. Cumplimiento de las bases

- [ ] Código en repositorio abierto (GitHub).
- [ ] Licencia **CC BY-NC**, disponible para la SESNA y otras autoridades.
- [ ] Documentación de metodología y tecnologías, replicable por un tercero.
- [ ] **Sin datos personales sensibles, reservados ni confidenciales**: se usan **datos sintéticos**.
- [ ] Sin código malicioso (validación de archivos y escaneo).
- [ ] **Declarar el uso de IA**, su finalidad y alcance (incluido el modelo NER y cualquier asistencia en el desarrollo).
- [ ] Presentación ejecutiva con evidencia de funcionamiento (demo o capturas).
- [ ] Al menos una persona del equipo disponible para viajar a la CDMX si resultan ganadores.

## 11. Plan hacia la entrega

Fechas clave: entrega **13 de noviembre (23:59)**, presentación **17 y 18 de noviembre**.

| Bloque | Contenido |
|---|---|
| Núcleo de privacidad | Frase de recuperación, sin terceros ni bitácoras, limpieza de metadatos |
| Experiencia | Formulario por pasos, borrador local, landing, accesibilidad |
| Depurador | Reglas primero, luego modelo NER local |
| Datos | Generador de datos sintéticos, agregados con umbral k, tablero |
| Cierre | Modelo de amenazas, documentación, presentación y demo |

**Prioridad si falta tiempo:** núcleo de privacidad y experiencia primero. El tablero público con indicadores por ente es el extra.

## 12. Pendientes y preguntas abiertas

- Revisar la API y la versión de pruebas del S5.
- Definir tipos de falta, valor de k y alcance del tablero.
- Confirmar si se pueden integrar fuentes externas a la PDN.
- Definir nombre, identidad visual y reparto de roles del equipo.

## Contacto de la convocatoria

dataton@sesna.gob.mx · dataton.anticorrupcion.sesna@gmail.com
# Plan de desarrollo — Buzón anónimo de denuncias (Datatón Anticorrupción 2026)

Versión 0.1 · 29 de octubre de 2026
Equipo: 5 desarrolladores · **Entrega: 13 de noviembre** · Presentaciones: 17 y 18 de noviembre

---

## 1. Alcance en una línea

Buzón de denuncias sobre el S5 con acceso por frase de recuperación, depuración de identificadores y metadatos en el dispositivo, seguimiento claro del estatus y tablero público protegido con k-anonimato.

## 2. Requerimientos

### 2.1 Funcionales

| ID | Requerimiento |
|---|---|
| RF-01 | Presentar una denuncia sin cuenta, correo ni teléfono |
| RF-02 | Generar en el dispositivo una frase de recuperación de 6 palabras y usarla como único medio de acceso |
| RF-03 | Consultar el estatus de la denuncia con la frase, en una línea de tiempo comprensible |
| RF-04 | Formulario por pasos con borrador local opcional |
| RF-05 | Detectar en el navegador datos que puedan identificar al denunciante (reglas y modelo NER) y sugerir su eliminación |
| RF-06 | Limpiar metadatos de las evidencias en el dispositivo y verificarlos de nuevo en el servidor |
| RF-07 | Recibir evidencias con validación de tipo y tamaño, revision de magic bytes |
| RF-08 | Panel mínimo para la autoridad receptora: ver denuncias sin datos del denunciante y actualizar estatus |
| RF-09 | Mapa nacional, estatal y municipal con conteos agregados |
| RF-10 | Estadísticas por tipo de falta y estatus con umbral k, supresión complementaria y agregación jerárquica |
| RF-11 | Indicadores de seguimiento por ente (si el S5 expone los datos) |
| RF-12 | Descarga de datos abiertos agregados (CSV y JSON) |
| RF-13 | Capa de integración con el S5 con implementación simulada (mock) y real intercambiables |
| RF-14 | Generador de datos sintéticos de denuncias |

### 2.2 No funcionales

| ID | Requerimiento |
|---|---|
| RNF-01 | Sin recursos de terceros: sin captchas, analítica, fuentes ni mapas externos |
| RNF-02 | No registrar ni persistir IP ni user-agent. Límite de intentos solo en memoria |
| RNF-03 | HTTPS, HSTS, CSP restrictiva, cookies mínimas o nulas |
| RNF-04 | Accesibilidad WCAG 2.0 AA, móvil primero, funcional con poco ancho de banda |
| RNF-05 | Mensajes de error uniformes en el acceso por frase (no revelar si un folio existe) |
| RNF-06 | Código abierto en GitHub, licencia CC BY-NC, documentación replicable |
| RNF-07 | Solo datos sintéticos: ningún dato personal sensible, reservado ni confidencial |
| RNF-08 | Despliegue reproducible con un solo comando (Docker Compose) |
| RNF-09 | Declaración del uso de IA (modelo NER y asistencia en desarrollo) |
| RNF-10 | El tablero público solo lee datos agregados, nunca las denuncias individuales |

## 3. Arquitectura y stack propuesto

Ajusten al stack que domine el equipo. Lo importante son las **fronteras** entre módulos.

| Capa | Propuesta |
|---|---|
| Frontend | TypeScript + React (Next.js) |
| Backend | Node + Typescript (Express) |
| Base de datos | PostgreSQL |
| Hash de la frase | Argon2id |
| NER en el navegador | Transformers.js u ONNX Runtime Web, modelo cuantizado |
| Mapas | GeoJSON o SVG local (marco geoestadístico de INEGI), **sin teselas externas** |
| Despliegue | Docker Compose |

### Fronteras clave

1. **Frontera del cliente:** el texto y los archivos se analizan y limpian en el navegador. Al servidor solo llega el contenido ya depurado.
2. **Frontera de la frase:** la frase se genera en el cliente. El servidor solo guarda un identificador derivado (Argon2id), nunca la frase.
3. **Frontera de agregación:** el tablero público lee solo una vista o tabla de agregados que calcula el módulo M5. Nunca toca las denuncias individuales.
4. **Frontera del S5:** todo acceso al S5 pasa por un adaptador con dos implementaciones (mock y real).

## 4. Módulos y responsables

| Módulo | Responsable | Enfoque |
|---|---|---|
| **M1** Backend y acceso | Dev 1 | API, frase de recuperación, estatus, panel de autoridad, adaptador S5 |
| **M2** Frontend del denunciante | Dev 2 | Landing, formulario, línea de tiempo, accesibilidad |
| **M3** Privacidad en el cliente | Dev 3 | Depurador de texto, limpieza de metadatos en el navegador |
| **M4** Seguridad e infraestructura | Dev 4 | Evidencias, cabeceras, modelo de amenazas, Docker y CI |
| **M5** Datos y tablero público | Dev 5 | Datos sintéticos, k-anonimato, mapa, indicadores, datos abiertos |

**Roles transversales** (se suman al módulo):
- **Integración y repositorio:** Dev 1.
- **Documentación general y presentación:** Dev 2 y Dev 5, con aportes de todos.
- **Modelo de amenazas:** Dev 4, con revisión de todos.
- **Pruebas de accesibilidad:** Dev 2 y Dev 3 cruzados.

### Contratos entre módulos

| Entre | Contrato |
|---|---|
| M2 ↔ M1 | API REST descrita en OpenAPI (se define en el sprint 0) |
| M2 ↔ M3 | Librería con funciones `escanearTexto(texto)` → hallazgos y `limpiarArchivo(archivo)` → archivo limpio |
| M1 ↔ M4 | M4 expone el servicio de evidencias y la verificación de metadatos que M1 invoca |
| M1 ↔ M5 | Las denuncias alimentan un proceso de agregación. M5 solo publica agregados |
| M1 ↔ S5 | Interfaz `AdaptadorS5` con `MockS5` y `RealS5` |

## 5. Historias de usuario por módulo

Prioridad: **M** = Must (indispensable), **S** = Should (muy deseable), **C** = Could (si sobra tiempo).

### M1 — Backend y acceso

| ID | Historia | Pri. | Criterios de aceptación |
|---|---|---|---|
| HU-01 | Como persona denunciante, quiero enviar una denuncia sin crear cuenta ni dar datos de contacto, para no exponerme | M | No hay campos de correo ni teléfono. No se guarda IP. La respuesta confirma el envío y genera un folio para seguir mis denuncias entrar en mi buzon. Se genera una frase de 6 palabras en caso de que el folio se pierda, se pueda usar esa fase de recuperacion. |
| HU-02 | Como persona denunciante, quiero acceder con mi folio generado o una frase de 6 palabras que se genere en mi dispositivo, para recuperar mi denuncia sin cuenta | M | El servidor nunca recibe la frase, solo un identificador derivado con Argon2id. 6 palabras de una lista de 2048 |
| HU-03 | Como persona denunciante, quiero consultar el estatus con mi frase o folio, para saber qué pasó | M | Error uniforme si la frase o folio no existe. Límite de intentos en memoria. |
| HU-04 | Como persona denunciante, quiero recibir mensajes o solicitudes de la autoridad, para responder sin identificarme | S | Bandeja ligada a la denuncia. La autoridad no ve datos del denunciante |
| HU-05 | Como autoridad receptora, quiero ver las denuncias recibidas y actualizar su estatus, para tramitarlas | S | Acceso con autenticación propia. Sin datos del denunciante. Cada acción queda registrada |
| HU-06 | Como equipo, quiero un adaptador al S5 con versión simulada y versión real, para no depender de la API definitiva | M | Misma interfaz para ambas. Cambio por configuración. Mock con datos sintéticos |

### M2 — Frontend del denunciante

| ID | Historia | Pri. | Criterios de aceptación |
|---|---|---|---|
| HU-07 | Como visitante, quiero una landing con los pasos para denunciar, para entender el proceso | M | Lenguaje claro. Qué ve y qué no ve la autoridad. Carga rápida en móvil |
| HU-08 | Como persona denunciante, quiero un formulario por pasos, para no abrumarme | M | Pasos: hechos, personas o entes, evidencias, revisión. Puedo volver atrás |
| HU-09 | Como persona denunciante, quiero ver y guardar mi frase de recuperación, para no perder el acceso | M | Copiar, imprimir y QR. No puedo continuar sin confirmar que la guardé |
| HU-10 | Como persona denunciante, quiero ver el estatus en una línea de tiempo, para entender en qué etapa está | M | Etapas en lenguaje claro y plazos esperados |
| HU-11 | Como persona denunciante, quiero guardar un borrador solo en mi dispositivo, para no perder lo escrito | S | Almacenamiento local. Aviso de riesgo en equipos compartidos. |
| HU-12 | Como persona denunciante, quiero un botón de salida rápida, para cerrar todo si alguien se acerca | S | Un clic cierra la pestaña o redirige y limpia el borrador |
| HU-13 | Como persona con discapacidad o poca experiencia, quiero usar el sistema sin barreras, para poder denunciar | M | Auditoría WCAG 2.0 AA documentada. Navegación por teclado y lector de pantalla |

### M3 — Privacidad en el cliente

| ID | Historia | Pri. | Criterios de aceptación |
|---|---|---|---|
| HU-14 | Como persona denunciante, quiero que se detecten datos identificantes en mi texto, para no revelarme sin querer | M | Detecta CURP, RFC, teléfonos, correos, CLABE, placas. Todo corre en el navegador |
| HU-15 | Como persona denunciante, quiero que el sistema sugiera redactar nombres, cargos y lugares, para reducir riesgos | S | Modelo NER local y opcional. Sugiere, no obliga. Funciona sin conexión tras la primera carga |
| HU-16 | Como persona denunciante, quiero avisos de riesgo contextual, para saber qué detalles podrían identificarme | C | Avisos sobre fechas exactas y descripciones únicas ("el único que...") |
| HU-17 | Como persona denunciante, quiero que mis evidencias se limpien de metadatos antes de subirlas, para no filtrar autor, ubicación o equipo | M | Imágenes, PDF y Office. Muestra qué se eliminó. Probado con archivos de ejemplo |
| HU-18 | Como persona denunciante, quiero ver una vista previa de lo que se enviará, para confirmar antes de enviar | C | Muestra texto depurado y archivos limpios |

### M4 — Seguridad e infraestructura

| ID | Historia | Pri. | Criterios de aceptación |
|---|---|---|---|
| HU-19 | Como equipo, quiero recibir evidencias con validación y antimalware, para cumplir la regla de no distribuir código malicioso | C | Valida tipo y tamaño. ClamAV. Rechaza ejecutables |
| HU-20 | Como equipo, quiero verificar metadatos en el servidor, para no depender solo del cliente | M | Segunda limpieza. Si quedan metadatos, se eliminan o se rechaza |
| HU-21 | Como equipo, quiero cifrar las evidencias en reposo, para proteger los archivos almacenados | S | Cifrado con clave fuera de la base de datos |
| HU-22 | Como equipo, quiero cero recursos de terceros y cero registros de IP, para garantizar el anonimato | M | Prueba automatizada que falla si la página solicita un dominio externo. Sin IP en bitácoras |
| HU-23 | Como equipo, quiero una prueba de trabajo autoalojada en lugar de captcha, para frenar abuso sin terceros | M | Altcha u otra. Integrada en envío y consulta |
| HU-24 | Como equipo, quiero cabeceras de seguridad, para endurecer el sitio | M | HTTPS, HSTS, CSP restrictiva, cookies mínimas |
| HU-25 | Como evaluador, quiero un modelo de amenazas con pruebas, para verificar que el anonimato se demuestra | M | Documento con amenazas, mitigaciones y evidencia de pruebas (antes y después) |
| HU-26 | Como equipo, quiero despliegue con un comando, para que un tercero pueda replicar | M | Docker Compose. README con pasos |

### M5 — Datos y tablero público

| ID | Historia | Pri. | Criterios de aceptación |
|---|---|---|---|
| HU-27 | Como equipo, quiero un generador de datos sintéticos, para desarrollar y probar sin datos reales | M | Genera denuncias con estado, municipio, tipo, estatus y fechas. Distribución realista (muchas en grandes, pocas en pequeños) |
| HU-28 | Como visitante, quiero un mapa con conteos por nivel nacional, estatal y municipal, para ver dónde hay denuncias | M | Mapa de calor con GeoJSON local. Cambio de nivel con clic |
| HU-29 | Como visitante, quiero estadísticas por tipo de falta y estatus, para entender el panorama | M | Gráficas con tablas accesibles equivalentes |
| HU-30 | Como equipo, quiero un motor de agregación con k-anonimato, para que las estadísticas no identifiquen a nadie | M | Umbral k configurable (inicial 5), agregación jerárquica, supresión complementaria, máximo dos dimensiones, cortes por periodo |
| HU-31 | Como equipo, quiero pruebas que intenten romper el k-anonimato, para demostrar que funciona | M | Pruebas automáticas del ataque por resta y de celdas pequeñas |
| HU-32 | Como visitante, quiero ver si las entidades dan seguimiento a las denuncias, para exigir rendición de cuentas | S | Porcentaje atendido y tiempos por etapa, con k aplicado a entes pequeños. Depende de lo que exponga el S5 |
| HU-33 | Como persona usuaria de datos, quiero descargar los agregados en CSV y JSON, para reutilizarlos | S | Solo datos ya protegidos. Diccionario de datos incluido |

## 6. Calendario

Hoy es 29 de octubre. Quedan 15 días.

| Fechas | Fase | Objetivo |
|---|---|---|
| **29–30 oct** | Sprint 0: decisiones y base | Stack, repositorio, licencia, lista de palabras, esquema de datos sintéticos, contrato OpenAPI, esqueleto con Docker Compose, revisión del S5 de pruebas |
| **31 oct – 5 nov** | Sprint 1: núcleo | Todas las historias **M** de cada módulo funcionando por separado |
| **6 – 10 nov** | Sprint 2: integración | Integración de módulos, historias **S**, pruebas cruzadas. **Congelamiento de funcionalidades el 10 nov por la noche** |
| **11 – 12 nov** | Endurecimiento | Pruebas de seguridad y accesibilidad, modelo de amenazas, documentación, guion de demo, video de respaldo, presentación |
| **13 nov** | Entrega | Subir producto final **a mediodía** (no esperar a las 23:59) |
| **14 – 16 nov** | Ensayo | Ensayos de la presentación |
| **17 – 18 nov** | Presentación | Presentación ante el jurado |

Reuniones sugeridas: una de 15 minutos al día, y una revisión de integración a mitad de cada sprint.

## 7. Entregables que pide la convocatoria

| Entregable | Responsable principal | Apoyo |
|---|---|---|
| Presentación ejecutiva con demo o capturas | Dev 2 | Dev 5, todos |
| Repositorio con código fuente | Dev 1 | Todos |
| Documentación (metodología, tecnologías, réplica) | Dev 5 | Cada dueño de módulo escribe su README |
| Modelo de amenazas | Dev 4 | Todos |
| Declaración de uso de IA | Dev 3 | Dev 1 |

## 8. Definición de terminado

Una historia está terminada cuando:
- cumple sus criterios de aceptación;
- tiene al menos una prueba automática o manual documentada;
- pasa la revisión de otra persona del equipo;
- está integrada en la rama principal y se despliega con `docker compose up`;
- no introduce recursos de terceros ni registros de IP.

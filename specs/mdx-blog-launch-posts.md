---
title: Blog con MDX y dos posts de lanzamiento
status: implemented
priority: medium
---

## Summary

desgrava.ar tiene un funnel de adquisición orientado a SEO programático y founder-led X (per `0-to-1000-users-growth-plan.md`), pero no tiene un canal editorial propio: ningún blog, ningún feed indexable de contenido evergreen sobre Ganancias / SiRADIG / deducciones. Esto le cierra la puerta a tráfico orgánico de cola larga ("¿qué es el F.572?", "cómo deducir alquiler en Ganancias", "qué pasa si no presento SiRADIG") y deja al `/simulador` como única página de contenido optimizada para búsqueda. Esta feature suma una sección `/blog` con dos posts de lanzamiento escritos íntegramente en MDX (frontmatter + Markdown), montada sobre el route group `(public)/`. Los dos primeros posts son: (1) **"Qué es desgrava.ar y en qué te puede ayudar"** — explica el producto en términos del problema (Ganancias se queda con plata que es tuya); y (2) **"Cómo funciona desgrava.ar: 3 ejemplos paso a paso"** — muestra el flujo end-to-end con tres casos ilustrativos basados en las personas del simulador (`familia-tipo`, `soltero-inquilino`, `profesional-hijos-colegio`), claramente etiquetados como "ejemplo orientativo" porque el producto está a cero usuarios pagos. La meta no es solo conversión — es construir el suelo de contenido que las páginas programáticas de SEO van a referenciar internamente, y que los hilos de X van a poder linkear sin tener que repetir el contenido cada vez.

## Acceptance Criteria

### A. Stack y scaffolding MDX

- [ ] Dependencias agregadas a `package.json`: `next-mdx-remote@^5` (rendering de MDX desde el filesystem en RSC), `gray-matter@^4` (parsing de frontmatter), `reading-time@^1` (calcular tiempo de lectura), `@tailwindcss/typography@^0.5` (estilos `prose`)
- [ ] `@tailwindcss/typography` registrado en `src/app/globals.css` mediante la directiva `@plugin "@tailwindcss/typography";` (Tailwind 4)
- [ ] El contenido de los posts vive en el filesystem: directorio nuevo `content/blog/` en la raíz del repo, con un archivo `.mdx` por post (no en `src/`, porque no es código)
- [ ] El frontmatter de cada post sigue exactamente este schema (validado con Zod en `src/lib/blog/schema.ts`):

  ```yaml
  ---
  slug: que-es-desgrava
  title: ¿Qué es desgrava.ar y en qué te puede ayudar?
  description: Una descripción de 140–160 caracteres con la promesa principal del post.
  date: 2026-02-10
  author: Nicolás Albani
  ogTitle: opcional, override del title para Open Graph
  ogDescription: opcional, override de la descripción para Open Graph
  ---
  ```

- [ ] Helpers en `src/lib/blog/`:
  - `posts.ts` — `getAllPosts()` y `getPostBySlug(slug)` que leen el directorio `content/blog/`, parsean frontmatter con `gray-matter`, validan con Zod, y devuelven `{ slug, frontmatter, content, readingTimeMinutes }`. Usan `fs.readdirSync` / `fs.readFileSync` con runtime Node (no Edge).
  - `schema.ts` — Zod schema del frontmatter; falla en `getPostBySlug` si un post tiene frontmatter inválido (mejor romper el build que servir un post roto).
- [ ] `mdx-components.tsx` en la raíz del proyecto define el override de componentes MDX (heading anchors, link styling, `<pre>`/`<code>` con tokens semánticos). No usa colores raw — solo `text-foreground`, `text-muted-foreground`, `text-primary`, `border-border`.

### B. Rutas y páginas

- [ ] Nueva ruta `src/app/(public)/blog/page.tsx` — índice del blog
  - Lista todos los posts ordenados por `date` desc
  - Cada item muestra: title (h2, `text-2xl md:text-3xl`), description (1 párrafo, `text-muted-foreground`), `date` formateada en español (`10 de febrero de 2026`), `readingTimeMinutes` (`5 min de lectura`), y un link al post completo
  - H1 de la página: "Blog · desgrava.ar"; subtítulo: "Cómo funciona Ganancias en Argentina, qué podés deducir, y cómo desgrava.ar te ayuda a recuperar lo que es tuyo."
  - Layout: una sola columna, `max-w-3xl`, ítems separados por `border-b border-border` con padding generoso. Sin grid, sin cards — sobrio, tipo página de Notion / Substack
  - Si no hay posts, mostrar un placeholder ("Pronto vamos a publicar acá") — pero no es un caso real porque shippeamos con dos
- [ ] Nueva ruta `src/app/(public)/blog/[slug]/page.tsx` — post individual
  - Usa `generateStaticParams` para statiquear los dos slugs en build time
  - Usa `generateMetadata` para emitir `title`, `description`, `alternates.canonical`, `openGraph` (incluyendo `type: "article"`, `publishedTime`, `authors`) y `twitter.card: "summary_large_image"`
  - Header del post: título h1 (`text-3xl md:text-5xl`), metadata strip (`Nicolás Albani · 10 de febrero de 2026 · 5 min de lectura`) en `text-sm text-muted-foreground`
  - Cuerpo del post: `<article className="prose prose-neutral dark:prose-invert max-w-none">` con el MDX renderizado dentro
  - Footer del post: bloque de CTA al final (`<BlogPostCta>`) con título "Probá desgrava.ar 30 días gratis", descripción corta y botón primary "Empezar ahora" → `/login`. También un link "Ver más artículos" → `/blog`
  - Si el slug no existe, llama a `notFound()` (Next sirve la 404 estándar)

### C. Componentes nuevos

- [ ] `src/components/blog/post-card.tsx` — el item del listado en `/blog`
- [ ] `src/components/blog/blog-post-cta.tsx` — el bloque de CTA al final de cada post
- [ ] `src/components/blog/persona-example-card.tsx` — un componente MDX especial para mostrar un "ejemplo orientativo" en el segundo post: avatar/icono, nombre del caso (ej. "Familia tipo"), tabla de gastos mensuales por categoría, ahorro estimado, y banner inferior "Ejemplo orientativo — calculá tu caso real en /simulador". Se usa dentro del MDX como `<PersonaExampleCard persona="familia-tipo" ahorroAnual={1_800_000} />` y los datos los toma de `PERSONA_PRESETS` en `src/lib/simulador/personas.ts`
- [ ] El componente `<PersonaExampleCard>` se registra en `mdx-components.tsx` para que sea utilizable desde MDX sin import explícito en el `.mdx`

### D. Posts de lanzamiento (contenido completo)

- [ ] `content/blog/que-es-desgrava.mdx` — Post 1, frontmatter + prose abajo en la sección "Prose de los posts"
- [ ] `content/blog/como-funciona-desgrava.mdx` — Post 2, frontmatter + prose abajo en la sección "Prose de los posts"
- [ ] Ambos posts respetan voseo argentino (`recuperá`, `cargá`, `probá`, `enterate`)
- [ ] El segundo post usa `<PersonaExampleCard>` para los tres ejemplos ilustrativos (no inventa nombres propios — usa las personas del simulador)
- [ ] Cada `<PersonaExampleCard>` lleva el banner explícito "Ejemplo orientativo" para no presentarlo como caso real cuando todavía no tenemos clientes pagos

### E. SEO, sitemap y RSS

- [ ] `src/app/sitemap.ts` extendido para incluir `/blog` (priority 0.7, changeFrequency "weekly") y cada post individual (priority 0.6, changeFrequency "monthly", `lastModified` = fecha del post)
- [ ] El sitemap genera las entradas leyendo `getAllPosts()` — no se hardcodean slugs
- [ ] Cada post embebe LD-JSON `Article` schema en la página: `@type: "Article"`, `headline`, `description`, `datePublished`, `author`, `publisher` (desgrava.ar), `inLanguage: "es-AR"`, `articleSection: "Blog"`. Inyectado vía `<script type="application/ld+json">` en el `<head>` (similar al patrón usado en `simulador/page.tsx` para `FAQPage`)
- [ ] Nueva ruta `src/app/blog/rss.xml/route.ts` — devuelve un RSS 2.0 feed con los posts (channel title, link, description, items con title/link/description/pubDate/guid). `Content-Type: application/rss+xml; charset=utf-8`
- [ ] El layout root agrega `<link rel="alternate" type="application/rss+xml" title="desgrava.ar Blog" href="/blog/rss.xml">` en el `<head>` (vía `metadata.alternates.types`)

### F. Navegación y descubribilidad

- [ ] El navbar (`src/components/layout/navbar.tsx`) suma un link "Blog" → `/blog`. Posición: entre el link al simulador (si existe) y el botón de login. En mobile aparece dentro del menú hamburguesa
- [ ] El footer (`src/components/layout/landing-footer.tsx`) suma "Blog" en la columna de links
- [ ] El home (`src/app/page.tsx`) **no** suma una sección "Últimos artículos" en este spec — la home está saturada y el blog tiene su propio surface; lo evaluamos en un spec aparte una vez que haya 5+ posts

### G. Estilos y responsive

- [ ] Los headings, párrafos, listas, blockquotes y links del cuerpo del post usan `@tailwindcss/typography` con la variante `prose-neutral dark:prose-invert`, sobreescribiendo solo lo necesario en `mdx-components.tsx` (links en `text-primary`, blockquotes con `border-l-primary`)
- [ ] Cada post lee bien en pantallas de 320px: tipografía base 16px, line-height generoso, headings que no rompen layout (`break-words`), `<PersonaExampleCard>` colapsa la tabla a stack vertical en `<sm`
- [ ] Touch targets ≥44px (links del navbar, botón del CTA final, "Ver más artículos")
- [ ] Dark mode soportado en todas las superficies nuevas — sin clases `text-gray-*` raw, todo vía tokens semánticos

### H. Tests

- [ ] `src/lib/blog/__tests__/schema.test.ts` — el schema de frontmatter Zod rechaza posts sin `slug`, sin `title`, con fecha inválida, etc.
- [ ] `src/lib/blog/__tests__/posts.test.ts` — `getAllPosts()` ordena por fecha desc; `getPostBySlug` devuelve el post correcto y devuelve `null` para slugs inexistentes
- [ ] Sin tests de UI (los componentes son presentacionales y el contenido es estático — no agrega valor)

## Technical Notes

### Por qué MDX y no markdown puro

MDX permite embeber `<PersonaExampleCard>` dentro del segundo post sin tener que reescribir el ejemplo en HTML crudo o inventar shortcodes propios. Para dos posts con un componente custom, MDX es el camino más corto; markdown puro nos obligaría a hacer string interpolation o repetir HTML.

### Por qué `next-mdx-remote/rsc` y no `@next/mdx`

`@next/mdx` espera que cada `.mdx` sea una page (vive en `src/app/`). Eso fuerza nombres de carpeta atados al filesystem y no permite separar contenido de código. Con `next-mdx-remote/rsc` el contenido vive en `content/blog/` (no es código), se compila en un Server Component, y los componentes custom se inyectan vía argumento — más limpio para una sección editorial.

### Reglas de contenido para los posts

- **Voseo argentino consistente** — el resto del sitio ya lo usa (`Recuperá`, `Probá`, `Calculá`)
- **"Ejemplo orientativo" obligatorio** en cualquier mención de cifra de ahorro hasta que tengamos casos reales — confirmado en clarificación, opción A. Cuando aparezcan testimonios reales, abrimos un nuevo spec para añadir una sección "Casos reales" con foto/nombre/cita y dejamos los `<PersonaExampleCard>` como ilustración complementaria
- **Términos correctos**: ARCA (no AFIP, salvo en contexto histórico), F.572 Web / SiRADIG, Impuesto a las Ganancias (no "Ganancias" en minúscula al referirse al impuesto formalmente)
- **Sin promesas absolutas**: nunca "vas a recuperar X" — siempre "podrías recuperar hasta", "según tu caso", "estimación basada en…"

### Coherencia con specs existentes

- El segundo post usa explícitamente la lista de personas de `src/lib/simulador/personas.ts` — si esa lista cambia (se renombran personas, se ajustan montos de calibración), el post no se actualiza solo. Aceptable: dos posts es bajo costo de mantenimiento manual y los montos del simulador están "calibrados a CABA 2026" según el comentario del archivo
- `<PersonaExampleCard>` no llama al simulador en runtime — recibe `ahorroAnual` como prop y lo formatea. La cifra es una estimación calibrada manualmente, no un cálculo en vivo. Esto desacopla el contenido editorial del motor de cálculo (queremos poder editar prosa sin tocar el calculator)
- El RSS feed es minimalista (no incluye contenido completo, solo description) para no tener que serializar MDX a HTML — el lector va al sitio para leer

### Mobile-first

Diseño en 320px primero, breakpoints `sm:` `md:` `lg:` para enriquecer. El listado del blog es siempre una columna (no grid) — el costo de scroll en móvil es bajo cuando hay 2 ítems y se mantiene legible cuando crezca a 20. Los `<PersonaExampleCard>` colapsan la tabla horizontal a un stack vertical en `<sm`.

---

## Prose de los posts (a copiar literal a los `.mdx` durante implementación)

### Post 1 — `content/blog/que-es-desgrava.mdx`

```mdx
---
slug: que-es-desgrava
title: ¿Qué es desgrava.ar y en qué te puede ayudar?
description: desgrava.ar es la forma más rápida de cargar tus deducciones de Ganancias en SiRADIG y recuperar plata que de otro modo perdés todos los meses.
date: 2026-02-10
author: Nicolás Albani
---

Si estás en relación de dependencia y cobrás más de un cierto sueldo, ARCA te retiene Impuesto a las Ganancias todos los meses. Esa retención sale directo de tu recibo, sin que la veas pasar. Lo que casi nadie sabe — o sabe pero nunca llega a hacer — es que **una parte importante de esa plata se puede recuperar**: alquiler, prepaga, gastos médicos, intereses hipotecarios, personal doméstico, educación, cargas de familia. Todo eso es deducible. Pero para que ARCA lo descuente, tenés que cargarlo en un formulario online llamado **F.572 Web** (o SiRADIG, que es como se sigue llamando popularmente).

Y ahí es donde se pierde la plata.

## El problema no es Ganancias. Es la fricción.

Cargar el F.572 cada mes es un proceso lento y poco intuitivo. Hay que:

- Entrar al portal de ARCA con clave fiscal
- Abrir SiRADIG en una ventana popup que parece de 2008
- Buscar la categoría correcta para cada factura (alquiler, prepaga, salud, educación, ¿y este recibo del médico, dónde va?)
- Cargar CUIT, monto, fecha, descripción — uno por uno
- Volver el mes que viene y repetirlo todo

El resultado conocido: la mayoría de la gente carga sus deducciones **una vez al año, en marzo, antes del cierre del F.572** — si es que las carga. El resto del año, sigue dejando plata sobre la mesa todos los meses.

## Qué hace desgrava.ar

desgrava.ar automatiza ese proceso de punta a punta:

1. **Conectás tu cuenta de ARCA una sola vez.** Tus credenciales se guardan cifradas (AES-256-GCM) y solo se descifran en el momento exacto en que un trabajo de automatización las necesita.
2. **Importamos tus comprobantes desde Mis Comprobantes en ARCA.** Si tenés facturas en papel o PDF, las podés subir y el OCR (con fallback a Tesseract) les saca los datos automáticamente.
3. **Una IA clasifica cada factura por categoría de deducción.** No tenés que pensar si una consulta médica va en "Gastos médicos" o "Cuotas médico-asistenciales" — el sistema lo hace por vos, y aprende del catálogo global de proveedores que ya construimos.
4. **Cargamos el F.572 / SiRADIG por vos.** Un robot Playwright entra a SiRADIG, navega categoría por categoría, y carga las deducciones. Lo ves en tiempo real desde un panel con barra de progreso.

Lo que normalmente te lleva una hora cada mes, desgrava.ar lo hace en 10 minutos — y lo podés repetir cuantas veces quieras durante el año, sin tocar una sola pantalla de ARCA.

## ¿Para quién es desgrava.ar?

Para cualquier persona que:

- Esté **en relación de dependencia** y cobre por encima del mínimo no imponible de Ganancias
- Tenga **gastos deducibles** que hoy no está reportando: alquiler, prepaga, salud, educación, hipoteca, personal doméstico
- Quiera **dejar de tercerizar** este trámite a su contador o a su empleador, o que directamente no lo esté presentando

Si trabajás en relación de dependencia y nunca presentaste el F.572, casi seguro estás dejando entre **$1.000.000 y $3.000.000 al año** sin recuperar — depende de tu sueldo y de cuánto gastás en los rubros deducibles.

## Lo que no hace desgrava.ar (todavía)

Para ser honestos:

- No es un sistema para contadores con muchos clientes. Está pensado para vos, persona física, una sola CUIT.
- No reemplaza la liquidación anual de Ganancias (la del F.711) si tenés rentas de cuarta categoría como autónomo o monotributista — solo automatiza el F.572 web del régimen de empleados.
- No te asesora sobre qué deducciones te conviene tomar — aplica las reglas vigentes y los topes que ARCA publica, pero la decisión sobre qué cargar es tuya.

## Cómo empezar

Tenés un [simulador gratis](/simulador) donde podés ver, en menos de un minuto, cuánto podrías estar recuperando con tus gastos actuales. No pide tarjeta, no pide registro. Si el número te parece interesante, [creás una cuenta gratis](/login) y probás 30 días el flujo completo — incluida la presentación automática a SiRADIG — sin tarjeta de crédito.

En el próximo post te muestro cómo funciona en la práctica, con tres ejemplos concretos basados en perfiles típicos.
```

### Post 2 — `content/blog/como-funciona-desgrava.mdx`

```mdx
---
slug: como-funciona-desgrava
title: Cómo funciona desgrava.ar — 3 ejemplos paso a paso
description: Tres casos típicos que muestran cómo desgrava.ar carga tus deducciones en SiRADIG y cuánto podrías recuperar de Ganancias.
date: 2026-03-15
author: Nicolás Albani
---

En el [post anterior](/blog/que-es-desgrava) te conté qué es desgrava.ar y por qué existe. Acá te muestro cómo funciona en la práctica, paso a paso, con tres ejemplos basados en perfiles típicos del simulador. **Los tres son ejemplos orientativos** — los números están calibrados a costos típicos de CABA en 2026 y a la escala de Ganancias vigente, pero tu caso real depende de tu sueldo, tu lugar de residencia y tus gastos efectivos. Hacé el cálculo con tu propia plata en el [simulador](/simulador).

## El flujo de desgrava.ar (común a los tres casos)

Antes de los ejemplos, este es el camino que todos siguen una vez creada la cuenta:

1. **Conectás ARCA.** Una sola vez, con tu CUIT y clave fiscal. Se guarda cifrado.
2. **Importás tus comprobantes.** Un click trae todo lo que ARCA tiene a tu nombre en Mis Comprobantes — alquiler facturado por tu propietario, recibos de prepaga, facturas de salud, cuotas del colegio, etc.
3. **La IA clasifica las facturas por categoría.** Lo ves antes de que se cargue nada.
4. **Revisás y, si querés, ajustás.** Si una factura quedó mal categorizada, la cambiás. Si hay algo que no querés deducir, lo desmarcás.
5. **Apretás "Desgravar".** El robot abre SiRADIG y carga todo lo seleccionado. Lo ves en tiempo real con una barra de progreso.

Eso es todo. La primera vez que lo hacés tarda unos 10 minutos. A partir del segundo mes, son 2 minutos para revisar lo nuevo y volver a apretar "Desgravar".

## Ejemplo 1 — Soltero inquilino

<PersonaExampleCard persona="soltero-inquilino" ahorroAnualAproximado={1_100_000} />

Este caso típico es el de alguien que vive solo en un departamento alquilado en CABA o GBA. Las deducciones grandes son el **alquiler** (40% deducible con tope anual) y la **prepaga** (100% deducible con tope del 5% de la ganancia neta). Los gastos médicos sueltos del año (consultas que no cubre la prepaga, estudios, dentista) suman algo más.

Sin desgrava.ar, este perfil suele pasar el año entero sin cargar absolutamente nada en SiRADIG, porque la fricción mensual no compensa el esfuerzo de cargar pocas facturas en una interfaz mala. El resultado son alrededor de **un millón de pesos** que se pierden en retenciones que nunca se recuperan.

Con desgrava.ar, en la primera carga el sistema toma todas las facturas del año en curso desde Mis Comprobantes, las clasifica, y las presenta a SiRADIG en una sola corrida. Después es revisar mensualmente las facturas nuevas (típicamente 2 o 3) y volver a presentar.

## Ejemplo 2 — Familia tipo

<PersonaExampleCard persona="familia-tipo" ahorroAnualAproximado={1_900_000} />

Una pareja con un hijo, alquilando, con prepaga familiar. Acá entran tres deducciones grandes:

- **Alquiler** — el monto facturado mensualmente, con el tope del 40% deducible y el tope anual.
- **Prepaga** — el plan familiar es la deducción más fuerte de este perfil: 100% deducible hasta el 5% de la ganancia neta.
- **Cargas de familia** — el cónyuge si no supera el mínimo no imponible; el hijo menor de edad. Cada carga reduce la base imponible una cantidad fija anual.

Este es el perfil donde la diferencia entre cargar y no cargar es más visible: la prepaga familiar sola implica varios cientos de miles de pesos de ahorro al año si se reporta correctamente. desgrava.ar levanta el recibo desde ARCA, lo clasifica como `CUOTAS_MEDICO_ASISTENCIALES`, y lo carga en la sección correcta de SiRADIG. La parte de cargas de familia se completa una vez en `/datos-personales` y queda guardada para todos los meses.

## Ejemplo 3 — Profesional con hijos en colegio privado

<PersonaExampleCard persona="profesional-hijos-colegio" ahorroAnualAproximado={2_400_000} />

Acá las dos deducciones dominantes son la **prepaga familiar** y los **gastos educativos** (cuotas de colegio privado para los hijos). Educación es 100% deducible hasta el tope anual fijado por ARCA.

El detalle importante en este perfil: las cuotas del colegio se facturan a nombre del padre o la madre que paga, y para que SiRADIG las acepte hay que vincularlas a la carga de familia correspondiente (el hijo). desgrava.ar maneja ese link automáticamente — cuando creás la carga de familia "hijo" en `/datos-personales`, las facturas educativas a su nombre se asocian solas y se presentan vinculadas a la carga correcta en SiRADIG.

Sin esa vinculación correcta, SiRADIG rechaza la deducción educativa. Hacerlo a mano implica cargar la factura, ir a una segunda pantalla, buscar al hijo en una lista, vincular, guardar. desgrava.ar lo hace en una sola corrida.

## ¿Qué pasa después?

Una vez que ya cargaste todo el año en curso, el flujo siguiente es:

- **Cada mes**, cuando hay facturas nuevas en ARCA, recibís una notificación. Entrás a desgrava.ar, revisás lo nuevo (típicamente 2 a 5 comprobantes), apretás "Desgravar". Listo.
- **Si cambia algo** en tus deducciones (te mudás, cambiás de prepaga, cargas de familia nuevas), lo actualizás en `/datos-personales` y se refleja en la próxima presentación.
- **El cierre del F.572** (típicamente el 31 de marzo del año siguiente) es automático: el sistema te avisa antes y, si tenés todo cargado, no tenés que hacer nada más.

## Probalo gratis

Si estás leyendo esto en marzo, te queda hasta el 31 para presentar el F.572 del año fiscal anterior — desgrava.ar lo carga en una corrida.

[Probá desgrava.ar 30 días sin tarjeta](/login). Conectás ARCA, importás tus comprobantes, y ves el resultado antes de pagar nada. Si después no te convence, no se cobra nada — y los datos los borrás cuando quieras desde `/configuracion`.

Si querés tener una idea previa del orden de magnitud para tu caso, el [simulador](/simulador) te lo muestra en menos de un minuto sin pedir registro.
```

## Out of Scope

- Sección "Casos reales" con testimonios, fotos, citas y métricas verificadas — esperamos a tener clientes pagos
- Sección "Últimos artículos" en la home — re-evaluamos cuando tengamos 5+ posts
- Categorías, tags, tabla de contenidos por post, comentarios, búsqueda, autores múltiples — innecesarios con dos posts
- Newsletter / formulario de suscripción — separado y posterior
- Generación de OG images por post (`@vercel/og`) — usamos el OG default del sitio en esta primera entrega
- Internacionalización del blog — Argentina y español únicamente
- Editor visual / CMS / admin para posts — los posts se editan en MDX y se commitean al repo
- Programmatic SEO desde el blog (auto-generar artículos por scenario × profesión) — eso vive en el spec `0-to-1000-users-growth-plan.md` bajo "Channel 2 — Programmatic SEO" en `/calculadora/[slug]`, no en `/blog`
- Trackeo de eventos Umami específicos para clicks de blog posts — el funnel actual cubre el destino (`/login`, `/simulador`); medimos blog en agregado vía Umami pageviews
- Migración de los posts a una plataforma externa (Substack, Medium) — el contenido vive en el repo, único source of truth

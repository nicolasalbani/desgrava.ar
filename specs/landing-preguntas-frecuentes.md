---
title: Landing — Preguntas Frecuentes (objection-handling)
status: implemented
priority: medium
---

## Summary

La landing tiene hero, How It Works, FeaturesBento ("Todo lo que necesitas"), simulador embebido y planes — pero no responde a las objeciones concretas que un visitante argentino tiene antes de entregar credenciales de ARCA y cargar la tarjeta: ¿es seguro?, ¿esto sirve si soy autónomo?, ¿qué ve mi empleador?, ¿cuándo realmente recibo la plata?, ¿qué pasa si no me convence?, ¿en qué se diferencia de un contador?, ¿qué pasa si SiRADIG falla en medio? Hoy esas dudas se quedan en la cabeza del visitante y se traducen en pérdida de conversión. Esta feature suma una sección "Preguntas Frecuentes" como sub-bloque dentro del segmento `#desgrava` (debajo del FeaturesBento "Todo lo que necesitas"), con 7 preguntas curadas para responder objeciones de conversión — distinto del FAQ de cálculo que ya vive en `/simulador`. Aprovecha la oportunidad para extraer un componente genérico `<FaqAccordion>` que ambas superficies consumen como única fuente de marcado + `FAQPage` JSON-LD.

## Acceptance Criteria

### A. Componente genérico `<FaqAccordion>`

- [ ] Nuevo componente `src/components/landing/faq-accordion.tsx` que recibe:
  - `items: Array<{ q: string; a: string }>` — el dataset de preguntas y respuestas
  - `jsonLdId: string` — id del `<Script>` que emite el JSON-LD (debe ser único por página para evitar colisiones de DOM)
- [ ] Renderiza la lista de `<details>` con la misma estructura visual que el FAQ actual de `/simulador` — wrapper `border-border divide-border bg-card divide-y rounded-2xl border`, cada item con `summary` (q + ícono `+` que rota 45° al abrir) y `<p>` (a) en `text-muted-foreground`
- [ ] Emite el `FAQPage` JSON-LD vía `next/script` con el `id` recibido (mismo patrón que el FAQ existente)
- [ ] No renderiza `<h2>` ni subtítulo — el padre es dueño del encabezado de la sección, así puede variar por superficie
- [ ] Sin lógica de estado — usa `<details>` nativo (igual que el actual)

### B. Refactor de `simulador-faq.tsx`

- [ ] `src/components/landing/simulador-faq.tsx` usa internamente `<FaqAccordion>` con `jsonLdId="simulador-faq-jsonld"` y los 8 ítems actuales (no se cambian)
- [ ] La página `/simulador` no requiere cambios — sigue importando y usando `<SimuladorFaq />`
- [ ] El JSON-LD generado para `/simulador` es idéntico al actual (mismo `@context`, `@type: "FAQPage"`, mismo set de preguntas) — verificable comparando el output de `view-source:` antes y después

### C. Nuevo componente `<LandingFaq>`

- [ ] Nuevo componente `src/components/landing/landing-faq.tsx` que renderiza:
  - Encabezado: `<h2>Preguntas frecuentes</h2>` (`text-2xl md:text-3xl font-bold tracking-tight`) + subtítulo opcional `text-muted-foreground` ("Las dudas más comunes antes de empezar.")
  - `<FaqAccordion items={LANDING_FAQ_ITEMS} jsonLdId="landing-faq-jsonld" />`
- [ ] El dataset `LANDING_FAQ_ITEMS` vive como `const` en el mismo archivo y contiene exactamente las 7 preguntas + respuestas de la sección "Contenido de las 7 preguntas" abajo
- [ ] Las respuestas usan voseo argentino y son consistentes con el estado real del producto (sin prometer reintentos automáticos, sin prometer "devolución" como reintegro)

### D. Integración en la landing

- [ ] `src/app/page.tsx` monta `<LandingFaq />` dentro del segmento `#desgrava`, después del bloque "Todo lo que necesitas" + `<FeaturesBento />`, separado por el mismo divisor `border-border border-t pt-16` que ya separa HowItWorks del bento
- [ ] La nueva FAQ está dentro de un `<FadeIn>` (sin `delay` o con `delay={0}`) consistente con los otros bloques de la sección
- [ ] **No** se agrega anchor `id` propio a la FAQ — vive como sub-bloque de `#desgrava`, no como sección independiente
- [ ] **No** se agrega link "Preguntas" al `sectionLinks` del navbar — la sección ya tiene su entrada vía "Cómo funciona" → `#desgrava`

### E. Mobile responsive y dark mode

- [ ] La FAQ se lee correctamente en pantallas de 320px: el wrapper usa `max-w-3xl mx-auto`, los `<summary>` no truncan ni rompen layout, y el ícono `+` no causa overflow horizontal
- [ ] Touch targets ≥44px: cada `<summary>` tiene padding suficiente (`p-4 sm:p-5`) para satisfacer el mínimo
- [ ] Dark mode: solo se usan tokens semánticos (`bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `divide-border`) — sin clases `text-gray-*` raw

### F. SEO

- [ ] La home (`/`) ahora incluye exactamente un `FAQPage` JSON-LD (con id `landing-faq-jsonld`); el `/simulador` sigue teniendo exactamente uno (id `simulador-faq-jsonld`). No se duplica en ninguna página.
- [ ] Los 7 `mainEntity` del JSON-LD de la home tienen `name` y `acceptedAnswer.text` no vacíos y matchean al contenido visible (Google penaliza cuando el JSON-LD no coincide con la UI)

### G. Tests

- [ ] Sin tests nuevos — el contenido es presentacional puro y los datos viven inline. CLAUDE.md aclara que la regla de tests obligatorios aplica a `src/lib/` y `src/hooks/` únicamente.

## Technical Notes

### Por qué placement dentro de `#desgrava` y no como sección nueva

El visitante consume la página secuencialmente: hero → cómo funciona → "todo lo que necesitas" (features) → simulador → planes. Las objeciones que la FAQ responde son del tipo "¿esto realmente funciona y es seguro?" — preguntas que aparecen _después_ de ver las features y _antes_ de jugar con el simulador o ver pricing. Insertarla como sub-bloque dentro de `#desgrava` mantiene el flujo lógico sin sumar otro `min-h-screen` ni otro link en el navbar. La consecuencia es que `#desgrava` deja de ser estrictamente "min-h-screen" — el contenido es ahora más alto que una pantalla, lo cual está bien porque ya no es "una sola idea por scroll".

### Por qué extraer `<FaqAccordion>` y no duplicar

Hoy hay un solo FAQ; sumando la landing serían dos. Tres sería el momento natural de extraer, pero como el JSON-LD también se duplicaría textualmente (mismo schema, mismo wrapper `<Script>`, misma estructura de `<details>`), la extracción a costo cero ahora previene el bug clásico de desincronizar el JSON-LD del DOM al editar uno solo de los dos. La firma queda mínima (`items` + `jsonLdId`) — sin sobre-ingeniería.

### Mobile-first

- Diseño en 320px primero, con `flex` y padding que ya funcionan en el FAQ del simulador
- El `<summary>` en mobile debe quedar legible aunque la pregunta tenga 2 líneas — testear con la primera pregunta ("¿Cómo manejan mis credenciales de ARCA? ¿Es seguro?")
- El ícono `+` con `flex-shrink-0` no se aplasta en pantallas estrechas

### Coherencia con specs existentes

- La FAQ de `/simulador` queda intacta en contenido (8 calculation-focused) — esta spec **no** edita esas preguntas
- El refactor a `<FaqAccordion>` es transparente: misma marca visual, mismo JSON-LD, mismo id (`simulador-faq-jsonld`)
- Las respuestas reflejan el comportamiento real del producto descrito en `CLAUDE.md`:
  - Credenciales cifradas con AES-256-GCM
  - Cada SUBMIT_INVOICE es un job individual (no hay "transacción" multi-factura — si una falla las otras siguen firmes)
  - "There is no retry" — el usuario re-envía manualmente; no prometemos reintentos automáticos
  - Suscripciones: trial 30 días sin tarjeta, cancelación desde `/configuracion`

---

## Contenido de las 7 preguntas (a copiar literal a `landing-faq.tsx`)

1. **¿Cómo manejan mis credenciales de ARCA? ¿Es seguro?**
   Tu CUIT y clave fiscal se cifran con AES-256-GCM antes de guardarse. Solo se descifran en el momento exacto en que un trabajo de automatización las necesita y nunca quedan en memoria. Tu clave nunca se imprime en logs ni se comparte con terceros — la usamos exclusivamente para iniciar sesión en ARCA por vos.

2. **¿Sirve si soy monotributista o autónomo?**
   Por ahora no del todo. desgrava.ar está pensado para empleados en relación de dependencia que tienen que presentar el F.572 web (SiRADIG) — no liquidamos el F.711 ni Ganancias 4ta categoría. Si combinás un trabajo en relación de dependencia con monotributo, sí: igual cargamos las deducciones del F.572 que correspondan a ese trabajo.

3. **¿Mi empleador o ARCA pueden ver que uso desgrava.ar?**
   No. Todo lo que cargamos en SiRADIG se carga "desde tu CUIT" — para ARCA es indistinguible de una carga manual hecha por vos. Tu empleador solo ve las deducciones presentadas en el SiRADIG, no el medio por el que llegaron ahí.

4. **¿Cuándo voy a ver la plata?**
   No es una "devolución" como un reintegro de un solo pago: tus deducciones reducen la retención mensual de Ganancias en tu próximo recibo de sueldo. Cuando tu empleador toma el SiRADIG actualizado (típicamente en la liquidación del mes siguiente al que cargaste), aplica los nuevos topes y te retiene menos. La diferencia se ve directo en el bolsillo, mes a mes.

5. **¿Qué pasa si después de los 30 días gratis no quiero seguir?**
   No se cobra nada — la prueba es sin tarjeta de crédito. Solo te pedimos un medio de pago si elegís continuar al final del trial. Podés cancelar la suscripción cuando quieras desde `/configuracion` y los datos los borrás vos mismo desde el panel.

6. **¿En qué se diferencia de un contador?**
   Un contador es una persona que típicamente carga tus deducciones una vez al año, en marzo, y te cobra honorarios por la atención. desgrava.ar es software: presenta el F.572 todos los meses, sin sobrecostos por trámite, sin esperar respuesta de mail y sin pedirte que compartas tu clave fiscal por un canal inseguro. Si querés además asesoramiento contable puntual, el contador no se reemplaza — pero el trámite mensual del F.572 sí.

7. **¿Qué pasa si SiRADIG falla en medio de la presentación?**
   Cada factura que enviás se procesa como un trabajo de automatización individual e independiente. Si una falla, las que ya se cargaron quedan firmes en SiRADIG y vos ves el estado factura por factura en el panel. La fallida la podés re-enviar con un click cuando quieras, sin tocar las que ya se presentaron.

## Out of Scope

- Editar las 8 preguntas existentes del FAQ de `/simulador` — quedan intactas
- Búsqueda dentro de la FAQ, anchors a preguntas individuales (`/#preguntas/seguridad`), o "permalinks" a una pregunta — innecesario con 7 preguntas
- Tracking Umami específico de "abrió la pregunta X" — usamos pageviews agregados de Umami como medida del valor de la sección
- Variantes A/B de las preguntas — premature con cero usuarios pagos (per `0-to-1000-users-growth-plan.md`)
- Mover el FAQ a una página dedicada `/preguntas` o `/faq` — la landing es el lugar que importa para conversión
- Internacionalización — Spanish-only (igual que el resto del sitio)
- Schema "QAPage" o `Speakable` — `FAQPage` cubre el caso de uso evergreen
- Agregar la FAQ al sitemap como entrada propia — vive como sub-bloque de `/`
- Foto/avatar/firma de "respondido por Nicolás" — sin author byline, paralelo a la decisión del blog

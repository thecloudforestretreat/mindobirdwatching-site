/**
 * MBW Stripe Checkout Worker (FULL DROP-IN) - v43
 *
 * v39 updates:
 * - Creates or updates one CRM booking ledger row per inquiry/booking.
 * - Creates one durable CRM payment row per Stripe invoice and updates it when paid.
 * - Preserves every separate invoice instead of overwriting the inquiry's legacy invoice summary.
 *
 * v38 updates:
 * - Accepts invoice_payment.paid, invoice.paid, and invoice.payment_succeeded
 * - Awaits critical accounting writes before acknowledging Stripe webhooks
 * - Lets failed accounting writes return a retryable Worker failure to Stripe
 * - Uses the Sheets logger's duplicate response to prevent duplicate booking
 *   confirmations when Stripe sends multiple paid events for one invoice
 * - Resolves invoice IDs from string or expanded invoice-payment objects
 * - Applies the same durable acknowledgement behavior to completed Checkout
 *   sessions so deposits and direct Checkout payments are not silently lost
 *
 * v37 updates:
 * - Adds ACT017 Mountain Biking as an English-only invoice product
 * - Uses the existing $10 Stripe price as the manual-adjustment base
 * - Requires invoice pricing of +$10 for the $20 route or +$40 for the $50 route
 * - Blocks standard Checkout links for ACT017 to prevent a $10 undercharge
 * - Keeps MBW015 Butterfly Garden as a separate tour item
 *
 * v36 updates:
 * - Carry applied-deposit identifiers and invoice totals into accounting rows.
 * - Store invoice-level deposit amounts on the primary service row only.
 * - Preserve combined Stripe fees for both itemized and single-service invoices.
 *
 * v35 updates:
 * - Excludes applied-deposit credit lines from service/accounting logging
 * - Adds the original deposit PaymentIntent fee to the final payment fee
 * - Allocates actual combined Stripe fees only across positive service lines
 * - Handles single-service invoices with an applied deposit through itemized logging
 *
 * v34 updates:
 * - Keeps ACT016 Horseback Riding as an English-only invoice product
 * - Removes the ACT016 Spanish catalog entry
 * - Keeps all other English and Spanish product entries unchanged
 *
 * v33 updates:
 * - Adds ACT016 Horseback Riding with its verified live Stripe product and price IDs
 * - Adds the live $25 per-person base price, duration, image, and tour-page data
 * - Keeps all existing v32 minimum-party override, deposit, invoice, and logging behavior unchanged
 *
 * v29 updates:
 * v31 updates:
 * v32 updates:
 * - Allows a below-minimum party on invoice routes only after explicit staff confirmation
 * - Records the override reason, configured minimum, actual party size, and affected items in Stripe metadata
 * - Keeps payment-link minimum-party enforcement unchanged
 * - Refreshes TOURS from product catalog with current product-code catalog
 *
 * - Captures CRM inquiry/guest identifiers from personalized deposit Payment Links
 * - Adds available-deposit lookup and one-time PaymentIntent attachment to invoices
 * - Reuses the deposit Stripe Customer and records deposit application metadata
 * - Returns pre-deposit and remaining invoice balances to the create page
 *
 * v28 updates:
 * - Adds OSO001, OSO002, ACT010, and ACT021 in English and Spanish
 * - Uses the verified shared live Stripe product and price IDs for both languages
 * - Adds live pricing, capacity, duration, image, and tour-page data for the new products
 * - Keeps all existing v27 checkout, invoice, webhook, logging, and flat-pricing behavior unchanged
 *
 * v27 updates:
 * - Adds TRANS01, TRANS02, TRANS06, MBW017, and DEP001 in English and Spanish
 * - Adds pricing_model support to the public tours API
 * - Bills flat-price products once while retaining the real passenger count in metadata
 * - Treats price adjustments on flat products as per-booking adjustments
 *
 * v26 updates:
 * - Adds stripe_invoices sheet fields for standard_price_per_person, price_adjustment_per_person, final_price_per_person, pricing_reason, and pricing_notes
 * - Stores price_adjustment_per_person in Stripe invoice metadata when provided by the create page
 * - Keeps single-item price override billing behavior from v25
 *
 * v25 updates:
 * - Adds single-item invoice price override support for /stripe/api/create-invoice
 * - Keeps standard pricing unchanged when no override is entered
 * - Uses Stripe inline price_data only when an override price is provided
 * - Stores standard price, override price, pricing reason, and pricing notes in Stripe metadata
 * - Keeps customer-facing invoice line description clean
 * - Logs override pricing details to paid invoice Google Sheet rows
 *
 * v24 updates:
 * - Fixes agent_activity single-item field population (tour_code, tour_title, tour_date, language, party_size)
 * - Hardens checkout stripe_invoices agent_id fallback using PaymentIntent metadata when needed
 * - Adds booking confirmation webapp posting for successful checkout and invoice payments
 * - Adds booking confirmation diagnostics to /stripe/debug
 * - Adds GET /stripe/debug endpoint for fast Worker diagnostics
 * - Keeps manual GET /stripe/test-agent-log endpoint for direct agent_activity testing
 * - Keeps all existing single-item checkout and invoice behavior
 * - Keeps multi-item invoice creation route
 * - Keeps per-line Google Sheet logging for paid multi-item invoices
 * - Keeps optional agent_id tracking across checkout, invoice creation, and webhook logging
 * - Keeps dedicated POST /stripe/api/agent-activity endpoint for the /create page
 * - Adds GET /stripe/api/agent-activity for endpoint health checks
 * - Keeps agent_activity payload delivery by sending BOTH original fields and sheet-mapped fields
 * - Preserves agent_id as text exactly as provided, including leading zeros like 003 and 004
 * - Sends both payment_link_url and hosted_invoice_url for agent activity rows
 * - Uses duplicate-safe accounting writes across all supported paid-invoice events
 * - Keeps agent_activity logging synchronous for create link and send invoice actions
 * - Expands invoice.payments and resolves payment_intent from the new Clover invoice payments structure
 * - Improves stripe_receipt_url population for invoice-paid rows on stripe_invoices
 * - Adds automatic retry for Google Sheets writes (stripe_invoices and agent_activity)
 * - Adds clearer agent activity logging diagnostics in Worker logs
 */

const TOURS = [
  {
    "tour_code": "MBW004",
    "language": "en",
    "status": "active",
    "tour_title": "Jewels of the Morning Forest",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U3loQ08bCP8CXq",
    "price_id_live": "price_1T5eHI0wAAlYwqaVRkLFrsjW",
    "product_id_test": "prod_V91VuFFaZBoRJp",
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$60.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW_Tour_Options-10-MBW004_HDT_Image_En.jpg",
    "tour_page_url": "https://mindobirdwatching.com/tours/jewels-morning-forest-birding/",
    "description_one_liner": "Half-day guided birdwatching experience in the cloud forest of Mindo.Explore lush forest trails in search of toucans, tanagers, and hummingbirds during peak morning activity. Includes certified guide, equipment, and transportation.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW004",
    "language": "es",
    "status": "active",
    "tour_title": "Joyas del Bosque Nublado",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U3lo0zterNy2fn",
    "price_id_live": "price_1T5eHG0wAAlYwqaVOTk4QH1f",
    "product_id_test": "prod_V91VuFFaZBoRJp",
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$60.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW_Tour_Options-12-MBW004_HDT_Image_Es.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/tours/joyas-del-bosque-matutino/",
    "description_one_liner": "Experiencia guiada de observación de aves de medio día en el bosque nublado de Mindo.Recorre senderos naturales en busca de tucanes, tángaras y colibríes durante la actividad matutina. Incluye guía certificado, equipo y transporte.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW005",
    "language": "en",
    "status": "active",
    "tour_title": "Dance of the Andean Cock-of-the-Rock",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U3loSPhygfpu0k",
    "price_id_live": "price_1T5eH10wAAlYwqaVz8tpOkD0",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$85.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW_Tour_Options-6-MBW005_HDT_Image_En.jpg",
    "tour_page_url": "https://mindobirdwatching.com/tours/andean-cock-of-the-rock-dawn/",
    "description_one_liner": "Half-day guided birdwatching experience beginning at dawn in the cloud forest of Mindo.Starting at 5:00 AM, this immersive tour focuses on observing the spectacular Andean Cock-of-the-rock at its lek, followed by a forest hike in search of toucans, tanagers, and hummingbirds. Includes certified guide, transportation, and use of binoculars.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW005",
    "language": "es",
    "status": "active",
    "tour_title": "Danza del Gallo de Pena",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U3loiPBHvnR5Fs",
    "price_id_live": "price_1T5eGx0wAAlYwqaV5TCuyECE",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$85.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW_Tour_Options-8-MBW005_HDT_Image_Es.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/tours/gallo-de-la-pena-andino-al-amanecer/",
    "description_one_liner": "Experiencia guiada de observacion de aves de medio dia en el bosque nublado de Mindo, comenzando al amanecer.El enfoque principal es ver el gallo de pena andino en su lek, seguido de una caminata por el bosque para buscar tucanes y encuentros con varias especies de tangaras y colibries. Incluye transporte y uso de binoculares.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW006",
    "language": "en",
    "status": "active",
    "tour_title": "Quest for Five Toucans & the Andean Cock-of-the-Rock",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U3lowfXD94ZCLM",
    "price_id_live": "price_1T5eGd0wAAlYwqaV9nCLg8TA",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$115.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Full Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "3:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW_Tour_Options-2-MBW006_FDT_Image_En.jpg",
    "tour_page_url": "https://mindobirdwatching.com/tours/quest-five-toucans-guide/",
    "description_one_liner": "Full-day guided birdwatching expedition in the cloud forest of Mindo, starting at dawn. The tour begins with early-morning observation of the Andean Cock-of-the-rock at its lek, followed by an extended forest hike in search of five toucan species, including the Plate-billed Mountain Toucan, Yellow-throated Toucan, Choco Toucan, Pale-mandibled Aracari, and Cr",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW006",
    "language": "es",
    "status": "active",
    "tour_title": "En Busca de Cinco Tucanes y el Gallo de Pena",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U3lk731ViBgrPH",
    "price_id_live": "price_1T5eCv0wAAlYwqaVImHv8K8g",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$115.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Full Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "3:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW_Tour_Options-4-MBW006_FDT_Image_Es.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/tours/busqueda-cinco-tucanes-y-gallo-de-la-pena/",
    "description_one_liner": "Expedición guiada de observación de aves de día completo en el bosque nublado de Mindo, comenzando al amanecer. El tour inicia con la observación del gallo de pena andino en su lek, seguido de una caminata extendida en busca de cinco especies de tucanes, incluyendo el tucán andino piquigrueso, tucán garganta amarilla, tucán del Chocó, arasarí de pico pálido ",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW007",
    "language": "en",
    "status": "active",
    "tour_title": "Custom Half Day Tour",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4RvDweP9xpb7S",
    "price_id_live": "price_1T6J1T0wAAlYwqaVcGLLxSYz",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$125.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW007_CHDT_Image_Es.jpg",
    "tour_page_url": "https://mindobirdwatching.com/tours/custom-private-tour/",
    "description_one_liner": "This custom half-day tour in the cloud forest of Mindo is designed around your specific birding or nature interests. Led by an experienced local guide, the route and pace are adapted in real time for a personalized and relaxed experience.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW007",
    "language": "es",
    "status": "active",
    "tour_title": "Tour Personalizado de Medio Día",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4RrB8SyfoyZiN",
    "price_id_live": "price_1T6Ixj0wAAlYwqaVWSx0Tftn",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$125.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW007_CHDT_Image_En.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/tours/tour-personalizado-privado/",
    "description_one_liner": "Este tour personalizado de medio día en el bosque nublado de Mindo se adapta a tus intereses específicos de observación de aves o naturaleza. Con un guía local experto, el recorrido se ajusta al ritmo del grupo y a las especies objetivo, ofreciendo una experiencia íntima y flexible.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW008",
    "language": "en",
    "status": "active",
    "tour_title": "Custom Full Day Tour",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4S3IZLYYElblm",
    "price_id_live": "price_1T6J9K0wAAlYwqaVsvHjxEha",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$175.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Full Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "3:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW008_CFDT_Image_En.jpg",
    "tour_page_url": "https://mindobirdwatching.com/tours/custom-private-tour/",
    "description_one_liner": "This custom full-day tour offers an in-depth exploration of the Mindo cloud forest. Guided by a local expert, the itinerary is tailored to your target species, preferred pace, and field conditions for a complete and immersive day.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW008",
    "language": "es",
    "status": "active",
    "tour_title": "Tour Personalizado de Día Entero",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4RyVJeCKCckHT",
    "price_id_live": "price_1T6J4w0wAAlYwqaVCyBPx7tE",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$175.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Full Day",
    "pickup_time_local": "5:00 AM",
    "dropoff_time_local": "3:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW008_CFDT_Image_Es.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/tours/tour-personalizado-privado/",
    "description_one_liner": "Este tour personalizado de día entero permite una exploración profunda del bosque nublado de Mindo. Acompañado por un guía local experto, el día se organiza según tus intereses, especies objetivo y condiciones del entorno.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW009",
    "language": "en",
    "status": "active",
    "tour_title": "Flora Excursion Tour",
    "service_type": "nature_excursion",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4SClDcBRAs8jP",
    "price_id_live": "price_1T6JI80wAAlYwqaV15kuQSxC",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW009_HDT_Image_En.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Half-day Flora Excursion. Base price $50 per person; final quote depends on duration confirmed by staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW009",
    "language": "es",
    "status": "active",
    "tour_title": "Excursión Botánica",
    "service_type": "nature_excursion",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4S7pkbz2wkKKT",
    "price_id_live": "price_1T6JDT0wAAlYwqaVEnhrqHag",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 2,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "10:00 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW009_HDT_Image_Es.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Half-day Flora Excursion. Base price $50 per person; final quote depends on duration confirmed by staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW010",
    "language": "en",
    "status": "active",
    "tour_title": "Solo Birdwatching Experience",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4SI6ClQHc3hnU",
    "price_id_live": "price_1T6JNf0wAAlYwqaVLbVBR91F",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$99.00",
    "min_person": 1,
    "max_person": "1",
    "duration_label": "Half Day",
    "pickup_time_local": "6:15 AM",
    "dropoff_time_local": "9:30 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW010_HDT_Image_En.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "This solo birdwatching experience is designed for individual birders seeking focused guidance. Accompanied by a specialized guide, the outing targets specific species and adapts to your pace and observation goals.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW010",
    "language": "es",
    "status": "active",
    "tour_title": "Experiencia Individual de Avistamiento de Aves",
    "service_type": "birdwatching",
    "pricing_model": "per_person",
    "product_id_live": "prod_U4SH6LLn7jVzx8",
    "price_id_live": "price_1T6JN80wAAlYwqaVP3oec2w2",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$99.00",
    "min_person": 1,
    "max_person": "1",
    "duration_label": "Half Day",
    "pickup_time_local": "6:15 AM",
    "dropoff_time_local": "9:30 AM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/tour-promos/MBW010_HDT_Image_Es.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Esta experiencia individual de avistamiento de aves está pensada para observadores que buscan atención personalizada. Con un guía especializado, la salida se enfoca en especies objetivo y técnicas de observación adaptadas al participante.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW011",
    "language": "en",
    "status": "active",
    "tour_title": "Chocolate Tour",
    "service_type": "Experience",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6DwLwzLMZeiqk",
    "price_id_live": "price_1T81V60wAAlYwqaVFgNhmyTt",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$15.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-12-ChocolateTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Discover the story of Ecuadorian cacao during this engaging chocolate experience in Mindo. Learn how cacao grows on the tree and follow the full process that transforms cacao beans into chocolate. Through a hands-on demonstration you will see the traditional techniques used to ferment, roast, grind, and prepare chocolate. Finish the experience with a tasting",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW011",
    "language": "es",
    "status": "active",
    "tour_title": "Chocolate Tour",
    "service_type": "Experience",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6DwLwzLMZeiqk",
    "price_id_live": "price_1T81V60wAAlYwqaVFgNhmyTt",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$15.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-12-ChocolateTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Discover the story of Ecuadorian cacao during this engaging chocolate experience in Mindo. Learn how cacao grows on the tree and follow the full process that transforms cacao beans into chocolate. Through a hands-on demonstration you will see the traditional techniques used to ferment, roast, grind, and prepare chocolate. Finish the experience with a tasting",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW012",
    "language": "en",
    "status": "active",
    "tour_title": "Coffee Tour",
    "service_type": "Experience",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E1sf8yvF7013",
    "price_id_live": "price_1T81ZT0wAAlYwqaV1xlWLO7c",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$15.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-14-CoffeTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Experience the journey of Ecuadorian coffee during this interactive coffee tour in Mindo. Learn how coffee plants grow in the cloud forest and follow the full process from freshly harvested beans to a brewed cup of coffee. During the experience you will see traditional roasting and grinding methods and enjoy a tasting of locally produced coffee while learnin",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW012",
    "language": "es",
    "status": "active",
    "tour_title": "Coffee Tour",
    "service_type": "Experience",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E1sf8yvF7013",
    "price_id_live": "price_1T81ZT0wAAlYwqaV1xlWLO7c",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$15.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-14-CoffeTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Experience the journey of Ecuadorian coffee during this interactive coffee tour in Mindo. Learn how coffee plants grow in the cloud forest and follow the full process from freshly harvested beans to a brewed cup of coffee. During the experience you will see traditional roasting and grinding methods and enjoy a tasting of locally produced coffee while learnin",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW013",
    "language": "en",
    "status": "inactive",
    "tour_title": "Waterfall Hike",
    "service_type": "Nature Excursion",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E6B7qgd4L77T",
    "price_id_live": "price_1T81dp0wAAlYwqaV1yFQ47p2",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-3-WaterfallTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Cross with the world famous yellow cable car to the other side of the cloud forest and hike to scenic waterfalls near Mindo. Walk along scenic forest trails that lead to some of the region’s most picturesque waterfalls. Along the way your guide will introduce you to local plants, wildlife, and the unique ecosystems of the cloud forest. This experience combin"
  },
  {
    "tour_code": "MBW013",
    "language": "es",
    "status": "inactive",
    "tour_title": "Waterfall Hike",
    "service_type": "Nature Excursion",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E6B7qgd4L77T",
    "price_id_live": "price_1T81dp0wAAlYwqaV1yFQ47p2",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Half Day",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-3-WaterfallTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Cross with the world famous yellow cable car to the other side of the cloud forest and hike to scenic waterfalls near Mindo. Walk along scenic forest trails that lead to some of the region’s most picturesque waterfalls. Along the way your guide will introduce you to local plants, wildlife, and the unique ecosystems of the cloud forest. This experience combin"
  },
  {
    "tour_code": "MBW014",
    "language": "en",
    "status": "active",
    "tour_title": "Canopy/Ziplining",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E9sr3BOCvaYp",
    "price_id_live": "price_1T81hI0wAAlYwqaVmrGFVSpu",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$30.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-18-ZipLining.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Experience the thrill of flying above the cloud forest on this exciting canopy ziplining adventure near Mindo. Glide across multiple cables suspended high above the forest and enjoy breathtaking views of the surrounding mountains and jungle. Professional guides provide safety equipment and instructions, making this a fun and accessible adventure for both fir",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW014",
    "language": "es",
    "status": "active",
    "tour_title": "Canopy/Ziplining",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E9sr3BOCvaYp",
    "price_id_live": "price_1T81hI0wAAlYwqaVmrGFVSpu",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$30.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-18-ZipLining.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Experience the thrill of flying above the cloud forest on this exciting canopy ziplining adventure near Mindo. Glide across multiple cables suspended high above the forest and enjoy breathtaking views of the surrounding mountains and jungle. Professional guides provide safety equipment and instructions, making this a fun and accessible adventure for both fir",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW015",
    "language": "en",
    "status": "active",
    "tour_title": "Butterfly Garden",
    "service_type": "Nature",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6EC5jW6ndT675",
    "price_id_live": "price_1T81kK0wAAlYwqaVzzzFFdQH",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-5-ButterflyTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Visit one of Mindo’s beautiful butterfly gardens and observe dozens of colorful species up close. Walk through a peaceful sanctuary where butterflies fly freely while learning about their fascinating life cycle from egg to caterpillar to chrysalis and finally butterfly. This relaxing nature experience offers a wonderful opportunity for photography and a deep",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW015",
    "language": "es",
    "status": "active",
    "tour_title": "Butterfly Garden",
    "service_type": "Nature",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6EC5jW6ndT675",
    "price_id_live": "price_1T81kK0wAAlYwqaVzzzFFdQH",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-5-ButterflyTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Visit one of Mindo’s beautiful butterfly gardens and observe dozens of colorful species up close. Walk through a peaceful sanctuary where butterflies fly freely while learning about their fascinating life cycle from egg to caterpillar to chrysalis and finally butterfly. This relaxing nature experience offers a wonderful opportunity for photography and a deep",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW016",
    "language": "en",
    "status": "active",
    "tour_title": "Night Walk",
    "service_type": "Wildlife",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6EFlYwN9Zn4fy",
    "price_id_live": "price_1T81ml0wAAlYwqaVlv4UBHg1",
    "product_id_test": "prod_V91VUCZ3Hf9ygY",
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$35.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-13-NightWalk.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Discover the cloud forest after dark on this guided night walk in Mindo. As the forest changes at night, many fascinating creatures become active. Walk along forest trails with an experienced guide while searching for frogs, insects, spiders, and other nocturnal wildlife. This experience reveals a completely different side of the cloud forest and its incredi",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW016",
    "language": "es",
    "status": "active",
    "tour_title": "Night Walk",
    "service_type": "Wildlife",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6EFlYwN9Zn4fy",
    "price_id_live": "price_1T81ml0wAAlYwqaVlv4UBHg1",
    "product_id_test": "prod_V91VUCZ3Hf9ygY",
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$35.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-13-NightWalk.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Discover the cloud forest after dark on this guided night walk in Mindo. As the forest changes at night, many fascinating creatures become active. Walk along forest trails with an experienced guide while searching for frogs, insects, spiders, and other nocturnal wildlife. This experience reveals a completely different side of the cloud forest and its incredi",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW017",
    "language": "en",
    "status": "active",
    "tour_title": "Half-Day to Full-Day Extension",
    "service_type": "time_extension",
    "pricing_model": "per_person",
    "product_id_live": "prod_UeIg3TO5lJZm2W",
    "price_id_live": "price_1Tw58F0wAAlYwqaV6ShEenfL",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Upgrade a qualifying half-day tour by extending the scheduled experience. The final itinerary and additional time are coordinated with the guest.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW017",
    "language": "es",
    "status": "active",
    "tour_title": "Extensión de Medio Día a Día Completo",
    "service_type": "Tour Upgrade",
    "pricing_model": "per_person",
    "product_id_live": "prod_UeIg3TO5lJZm2W",
    "price_id_live": "price_1Tw58F0wAAlYwqaV6ShEenfL",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Mejore un tour de medio día extendiendo la experiencia programada. El itinerario final y el tiempo adicional se coordinan con el pasajero.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS01",
    "language": "en",
    "status": "active",
    "tour_title": "Quito -> Mindo",
    "service_type": "private_transfer",
    "pricing_model": "flat",
    "product_id_live": "prod_UvwuS6i7xitlyk",
    "price_id_live": "price_1Tw50p0wAAlYwqaVvV8IRT9R",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$99.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Private one-way transportation from Quito to Mindo. Pickup time and location are coordinated with the guest.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS01",
    "language": "es",
    "status": "active",
    "tour_title": "Quito -> Mindo",
    "service_type": "Transportation",
    "pricing_model": "flat",
    "product_id_live": "prod_UvwuS6i7xitlyk",
    "price_id_live": "price_1Tw50p0wAAlYwqaVvV8IRT9R",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$99.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Transporte privado de ida desde Quito hasta Mindo. La hora y el lugar de recogida se coordinan con el pasajero.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS02",
    "language": "en",
    "status": "active",
    "tour_title": "Mindo -> Quito",
    "service_type": "private_transfer",
    "pricing_model": "flat",
    "product_id_live": "prod_UvwxK6irRJqSKk",
    "price_id_live": "price_1Tw53X0wAAlYwqaVz2FzAU0H",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$99.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Private one-way transportation from Mindo to Quito. Pickup time and location are coordinated with the guest.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS02",
    "language": "es",
    "status": "active",
    "tour_title": "Mindo -> Quito",
    "service_type": "Transportation",
    "pricing_model": "flat",
    "product_id_live": "prod_UvwxK6irRJqSKk",
    "price_id_live": "price_1Tw53X0wAAlYwqaVz2FzAU0H",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$99.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Transporte privado de ida desde Mindo hasta Quito. La hora y el lugar de recogida se coordinan con el pasajero.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS06",
    "language": "en",
    "status": "active",
    "tour_title": "Quito -> Mindo -> Quito",
    "service_type": "private_transfer",
    "pricing_model": "flat",
    "product_id_live": "prod_UZOWczM0jBNQKF",
    "price_id_live": "price_1Tw4vR0wAAlYwqaVVACznAE8",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$180.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Private same-day round-trip transportation from Quito to Mindo and back to Quito. Pickup and return times are coordinated with the guest.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS06",
    "language": "es",
    "status": "active",
    "tour_title": "Quito -> Mindo -> Quito",
    "service_type": "Transportation",
    "pricing_model": "flat",
    "product_id_live": "prod_UZOWczM0jBNQKF",
    "price_id_live": "price_1Tw4vR0wAAlYwqaVVACznAE8",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$180.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Transporte privado de ida y vuelta el mismo día desde Quito hasta Mindo y regreso a Quito. Los horarios se coordinan con el pasajero.",
    "use_inline_price": true
  },
  {
    "tour_code": "DEP001",
    "language": "en",
    "status": "active",
    "tour_title": "Tour Reservation Deposit",
    "service_type": "reservation_deposit",
    "pricing_model": "flat_amount",
    "product_id_live": "prod_Ui8J2Sa9WWtBss",
    "price_id_live": "price_1Tii2R0wAAlYwqaVWVBQtIBW",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$100.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Deposit to reserve guided birdwatching tours and activities. Deposit amount will be credited toward the total booking cost. Reservation is confirmed upon receipt of deposit."
  },
  {
    "tour_code": "DEP001",
    "language": "es",
    "status": "active",
    "tour_title": "Reservation Deposit",
    "service_type": "Deposit",
    "pricing_model": "flat_amount",
    "product_id_live": "prod_Ui8J2Sa9WWtBss",
    "price_id_live": "price_1Tii2R0wAAlYwqaVWVBQtIBW",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$100.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Depósito utilizado para confirmar una reserva de tour o transporte. El depósito se aplica al saldo final de la reserva."
  },
  {
    "tour_code": "ACT004",
    "language": "en",
    "status": "active",
    "tour_title": "Quad Tour",
    "service_type": "guided_activity",
    "pricing_model": "per_quad",
    "product_id_live": "prod_V4Eoo4gfZT8hgf",
    "price_id_live": "price_1U46Kl0wAAlYwqaVrS3RS1m3",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$30.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "1 hour 15 minutes",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-8-QuadTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/quad-tour/",
    "description_one_liner": "Guided quad experience in Mindo with forest roads, scenic sections, and a route designed for a quick adventure block before or after birding. Price is per quad, not per person, and up to two guests may ride on one quad when conditions allow.",
    "use_inline_price": true,
    "max_guests_per_quad": 2
  },
  {
    "tour_code": "ACT004",
    "language": "es",
    "status": "active",
    "tour_title": "Tour en Cuadrones",
    "service_type": "actividad_guiada",
    "pricing_model": "per_quad",
    "product_id_live": "prod_V4Eoo4gfZT8hgf",
    "price_id_live": "price_1U46Kl0wAAlYwqaVrS3RS1m3",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$30.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "1 hour 15 minutes",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-8-QuadTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/actividades/tour-en-quad/",
    "description_one_liner": "Experiencia guiada en cuadrones en Mindo con caminos de bosque, secciones escenicas y una ruta ideal para sumar aventura antes o despues de observar aves. El precio es por cuadron, no por persona, y pueden ir hasta dos personas en un cuadron cuando las condiciones lo permiten.",
    "use_inline_price": true,
    "max_guests_per_quad": 2
  },
  {
    "tour_code": "ACT009",
    "language": "en",
    "status": "active",
    "tour_title": "Orchid Garden Tour",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4ExvdFyb17ogB",
    "price_id_live": "price_1U46U10wAAlYwqaVwPr8SyD3",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "12",
    "duration_label": "3-4 hours",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-7-OrchidGardenTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/orchid-garden-tour/",
    "description_one_liner": "Easy Mindo orchid garden visit focused on native orchids, seasonal blooms, conservation, and relaxed close-up nature observation. A simple add-on for guests who want a calm activity between birding, waterfalls, coffee, chocolate, or butterfly stops.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT009",
    "language": "es",
    "status": "active",
    "tour_title": "Tour Jardin de Orquideas",
    "service_type": "actividad_guiada",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4ExvdFyb17ogB",
    "price_id_live": "price_1U46U10wAAlYwqaVwPr8SyD3",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "12",
    "duration_label": "3-4 hours",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-7-OrchidGardenTour.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/actividades/jardin-de-orquideas/",
    "description_one_liner": "Visita facil a un jardin de orquideas en Mindo enfocada en orquideas nativas, floracion de temporada, conservacion y observacion tranquila de naturaleza. Buena actividad para combinar con aves, cascadas, cafe, chocolate o mariposas.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT010",
    "language": "en",
    "status": "active",
    "tour_title": "Frog Concert",
    "service_type": "Wildlife",
    "pricing_model": "per_person",
    "product_id_live": "prod_V0oaOmfBx0xxT4",
    "price_id_live": "price_1U0mx80wAAlYwqaV28fPtOxW",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Experience the “frog concert” in Mindo’s cloud forest at night!  This 2-hour guided tour reveals frogs, insects, and maybe even sleeping birds — all accompanied by the magical symphony of the forest.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT010",
    "language": "es",
    "status": "active",
    "tour_title": "Concierto de Ranas",
    "service_type": "Wildlife",
    "pricing_model": "per_person",
    "product_id_live": "prod_V0oaOmfBx0xxT4",
    "price_id_live": "price_1U0mx80wAAlYwqaV28fPtOxW",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Flexible",
    "pickup_time_local": null,
    "dropoff_time_local": null,
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "¡Vive el “concierto de ranas” en el bosque nublado de Mindo por la noche!  Este recorrido guiado de 2 horas revela ranas, insectos y hasta aves dormidas, todo acompañado por la mágica sinfonía del bosque.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT011",
    "language": "en",
    "status": "active",
    "tour_title": "Mindo River Tubing",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4F8G5SR9ZVpT0",
    "price_id_live": "price_1U46e40wAAlYwqaV60gnPlyY",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 4,
    "max_person": "12",
    "duration_label": "30 min",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-19-Tubing.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/tubing/",
    "description_one_liner": "Guided tubing descent on the Mindo River with specialized local guides and safety support. This is an active water activity and a good adventure add-on when river and weather conditions are appropriate. Group minimum pricing applies.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT011",
    "language": "es",
    "status": "active",
    "tour_title": "Tubing en el Rio Mindo",
    "service_type": "actividad_guiada",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4F8G5SR9ZVpT0",
    "price_id_live": "price_1U46e40wAAlYwqaV60gnPlyY",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 4,
    "max_person": "12",
    "duration_label": "30 min",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-19-Tubing.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/actividades/tubing/",
    "description_one_liner": "Descenso guiado en tubing por el Rio Mindo con guias locales especializados y apoyo de seguridad. Es una actividad activa de agua y una buena opcion de aventura cuando las condiciones del rio y clima lo permiten. Aplica precio minimo de grupo.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT013",
    "language": "en",
    "status": "active",
    "tour_title": "Canyoning",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4FER1Zpt3bTdC",
    "price_id_live": "price_1U46jc0wAAlYwqaVfHezAWhw",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$25.00",
    "min_person": 2,
    "max_person": "10",
    "duration_label": "1-2 hours",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-16-Canyoning.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/canyoning/",
    "description_one_liner": "Guided canyoning adventure near Mindo with waterfall descent, specialized guides, safety equipment, and local coordination. Best for active guests who want a stronger adventure block around the cloud forest.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT013",
    "language": "es",
    "status": "active",
    "tour_title": "Canyoning",
    "service_type": "actividad_guiada",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4FER1Zpt3bTdC",
    "price_id_live": "price_1U46jc0wAAlYwqaVfHezAWhw",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$25.00",
    "min_person": 2,
    "max_person": "10",
    "duration_label": "1-2 hours",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-16-Canyoning.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/actividades/canyoning/",
    "description_one_liner": "Aventura guiada de canyoning cerca de Mindo con descenso de cascada, guias especializados, equipo de seguridad y coordinacion local. Ideal para visitantes activos que buscan una experiencia de aventura mas fuerte en el bosque nublado.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT015",
    "language": "en",
    "status": "active",
    "tour_title": "Paintball",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4FLDj7uNbToKn",
    "price_id_live": "price_1U46qe0wAAlYwqaV6wl5Meur",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "20",
    "duration_label": "1 hour",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-10-PaintBall.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/paintball/",
    "description_one_liner": "Forest paintball activity in Mindo for friends, families, and groups who want a playful adventure add-on. Includes standard equipment and local coordination; best as a social activity after birding or on a flexible activity day.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT015",
    "language": "es",
    "status": "active",
    "tour_title": "Paintball",
    "service_type": "actividad_guiada",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4FLDj7uNbToKn",
    "price_id_live": "price_1U46qe0wAAlYwqaV6wl5Meur",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "20",
    "duration_label": "1 hour",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-10-PaintBall.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/actividades/paintball/",
    "description_one_liner": "Actividad de paintball en bosque en Mindo para amigos, familias y grupos que buscan una opcion divertida de aventura. Incluye equipo estandar y coordinacion local; ideal despues de aves o en un dia flexible de actividades.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT016",
    "language": "en",
    "status": "active",
    "tour_title": "Horseback Riding",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_VCSiUn8BZ8z2yu",
    "price_id_live": "price_1UC3my0wAAlYwqaVwIyXeRDZ",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$25.00",
    "min_person": 1,
    "max_person": 3,
    "duration_label": "1 hour base",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 30,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-11-HorsebackRiding.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/horseback-riding/",
    "description_one_liner": "Guided one-hour horseback ride through Mindo's cloud forest, priced per person. Longer rides require a confirmed price adjustment.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT017",
    "language": "en",
    "status": "active",
    "tour_title": "Mountain Biking - 2-hour Route",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_VHISKIAPc1ibr9",
    "price_id_live": "price_1UGjrQ0wAAlYwqaVAvKXHYd1",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Route dependent",
    "pickup_time_local": "flexible",
    "dropoff_time_local": "flexible",
    "pickup_window_minutes": 30,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/mountain-biking/act_mountain_biking_01.jpg",
    "tour_page_url": "https://mindobirdwatching.com/activities/mountain-biking/",
    "description_one_liner": "2-hour guided route, approximately 4 km. $20 per person. Optional Butterfly Garden admission is a separate $10.00 per-person add-on.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT021",
    "language": "en",
    "status": "active",
    "tour_title": "Private Insect & Macro Wildlife Search",
    "service_type": "private_macro_wildlife_search",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4D9GtgfNCW644",
    "price_id_live": "price_1U44jU0wAAlYwqaV6L448Guc",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$110.00",
    "min_person": 1,
    "max_person": "1",
    "duration_label": "Custom",
    "pickup_time_local": "custom",
    "dropoff_time_local": "custom",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-21-Insect-Macro-Wildlife-green.png",
    "tour_page_url": "https://mindobirdwatching.com/activities/private-insect-macro-wildlife-search/",
    "description_one_liner": "Private insect and macro wildlife search. $110 per person per private session. Confirm session count, timing and target species with staff. Sightings are not guaranteed.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT021",
    "language": "es",
    "status": "active",
    "tour_title": "Busqueda Privada de Insectos y Macrofauna",
    "service_type": "busqueda_privada_macrofauna",
    "pricing_model": "per_person",
    "product_id_live": "prod_V4D9GtgfNCW644",
    "price_id_live": "price_1U44jU0wAAlYwqaV6L448Guc",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$110.00",
    "min_person": 1,
    "max_person": "1",
    "duration_label": "Custom",
    "pickup_time_local": "custom",
    "dropoff_time_local": "custom",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/activities/MBW-Activities-21-Insect-Macro-Wildlife-green.png",
    "tour_page_url": "https://mindobirdwatching.com/es/actividades/busqueda-privada-insectos-macrofauna/",
    "description_one_liner": "Private insect and macro wildlife search. $110 per person per private session. Confirm session count, timing and target species with staff. Sightings are not guaranteed.",
    "use_inline_price": true
  },
  {
    "tour_code": "OSO001",
    "language": "en",
    "status": "active",
    "tour_title": "Extended Half-Day Spectacled Bear Tour",
    "service_type": "wildlife_tour",
    "pricing_model": "per_person",
    "product_id_live": "prod_V0o7Ar07bBJjSF",
    "price_id_live": "price_1U0mVS0wAAlYwqaV1AfuWtOm",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$150.00",
    "min_person": 2,
    "max_person": "8",
    "duration_label": "Extended Half Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "1:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/tours/osos/mbw_osos_img_03.jpg",
    "tour_page_url": "https://mindobirdwatching.com/tours/spectacled-bear-tour-ecuador/",
    "description_one_liner": "Private morning wildlife tour focused on searching for spectacled bears in Antisana or Cayambe-Coca. The route is selected according to recent wildlife activity, weather, access, and field conditions. Includes private guide, transportation, binoculars, and spotting scope.",
    "use_inline_price": true
  },
  {
    "tour_code": "OSO001",
    "language": "es",
    "status": "active",
    "tour_title": "Tour Extendido de Medio Día del Oso de Anteojos",
    "service_type": "wildlife_tour",
    "pricing_model": "per_person",
    "product_id_live": "prod_V0o7Ar07bBJjSF",
    "price_id_live": "price_1U0mVS0wAAlYwqaV1AfuWtOm",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$150.00",
    "min_person": 2,
    "max_person": "8",
    "duration_label": "Extended Half Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "1:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/tours/osos/mbw_osos_img_03.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/tours/tour-oso-de-anteojos-ecuador/",
    "description_one_liner": "Tour privado matutino enfocado en la búsqueda del oso de anteojos en Antisana o Cayambe-Coca. La ruta se selecciona según la actividad reciente de la fauna, el clima, el acceso y las condiciones de campo. Incluye guía privado, transporte, binoculares y telescopio.",
    "use_inline_price": true
  },
  {
    "tour_code": "OSO002",
    "language": "en",
    "status": "active",
    "tour_title": "Full-Day Spectacled Bear, Condor and Andean Wildlife Tour",
    "service_type": "wildlife_tour",
    "pricing_model": "per_person",
    "product_id_live": "prod_V0oKTFg77ReeDD",
    "price_id_live": "price_1U0mi00wAAlYwqaVki06qw9Q",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$200.00",
    "min_person": 2,
    "max_person": "8",
    "duration_label": "Full Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "6:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/tours/osos/mbw_osos_hero_01.jpg",
    "tour_page_url": "https://mindobirdwatching.com/tours/spectacled-bear-tour-ecuador/",
    "description_one_liner": "Full-day private Spectacled Bear expedition through Ecuador's high Andes. Starting at 6:00 AM, the guide selects the most promising route between Antisana and Cayambe-Coca using recent wildlife reports and current conditions. Along the way, guests may observe Spectacled Bears, Andean Condors, hummingbirds, deer, and other mountain wildlife. Includes certifie",
    "use_inline_price": true
  },
  {
    "tour_code": "OSO002",
    "language": "es",
    "status": "active",
    "tour_title": "Tour de Día Completo del Oso de Anteojos, Cóndor y Fauna Andina",
    "service_type": "wildlife_tour",
    "pricing_model": "per_person",
    "product_id_live": "prod_V0oKTFg77ReeDD",
    "price_id_live": "price_1U0mi00wAAlYwqaVki06qw9Q",
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$200.00",
    "min_person": 2,
    "max_person": "8",
    "duration_label": "Full Day",
    "pickup_time_local": "6:00 AM",
    "dropoff_time_local": "6:00 PM",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "https://mindobirdwatching.com/assets/images/pages/tours/osos/mbw_osos_hero_01.jpg",
    "tour_page_url": "https://mindobirdwatching.com/es/tours/tour-oso-de-anteojos-ecuador/",
    "description_one_liner": "Expedición privada de día completo para observar el Oso de Anteojos en los Andes del Ecuador. Desde las 6:00 AM, el guía selecciona la ruta más prometedora entre Antisana y Cayambe-Coca según reportes recientes y condiciones actuales. Durante el recorrido es posible observar osos de anteojos, cóndores andinos, colibríes, venados y otra fauna de montaña. Incl",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW002",
    "language": "en",
    "status": "active",
    "tour_title": "Cloud Forest Icons Tour",
    "service_type": "Birdwatching",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$70.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/tours/",
    "description_one_liner": "Cloud Forest Icons Tour. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "MBW002",
    "language": "es",
    "status": "active",
    "tour_title": "Cloud Forest Icons Tour",
    "service_type": "Birdwatching",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$70.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/tours/",
    "description_one_liner": "Cloud Forest Icons Tour. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT003",
    "language": "en",
    "status": "active",
    "tour_title": "Nambillo Waterfall",
    "service_type": "Nature Excursion",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E6B7qgd4L77T",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Nambillo Waterfall: $10 per person, admission and transportation included.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT003",
    "language": "es",
    "status": "active",
    "tour_title": "Cascada Nambillo",
    "service_type": "Nature Excursion",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6E6B7qgd4L77T",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Nambillo Waterfall: $10 per person, admission and transportation included.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT016",
    "language": "es",
    "status": "active",
    "tour_title": "Paseo a Caballo",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_VCSiUn8BZ8z2yu",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$25.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Paseo a Caballo. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT017",
    "language": "es",
    "status": "active",
    "tour_title": "Ciclismo",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_VHISKIAPc1ibr9",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Ciclismo. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT018",
    "language": "en",
    "status": "active",
    "tour_title": "Double Extreme Swing",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$25.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Double Extreme Swing. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT018",
    "language": "es",
    "status": "active",
    "tour_title": "Columpio Extremo Doble",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$25.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Columpio Extremo Doble. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT019",
    "language": "en",
    "status": "active",
    "tour_title": "Extreme Bike – Sky Bike",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Extreme Bike – Sky Bike. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT019",
    "language": "es",
    "status": "active",
    "tour_title": "Bicicleta Extrema - Sky Bike",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$20.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Bicicleta Extrema - Sky Bike. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT020",
    "language": "en",
    "status": "active",
    "tour_title": "Sky Ride",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$15.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Sky Ride. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT020",
    "language": "es",
    "status": "active",
    "tour_title": "Sky Ride",
    "service_type": "Adventure",
    "pricing_model": "per_person",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$15.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Sky Ride. Confirm availability and final itinerary with staff.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS05",
    "language": "en",
    "status": "active",
    "tour_title": "Custom",
    "service_type": "Transportation",
    "pricing_model": "flat",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/tours/",
    "description_one_liner": "Custom transportation: $50 base per booking. Staff must confirm route and final quote before payment.",
    "use_inline_price": true
  },
  {
    "tour_code": "TRANS05",
    "language": "es",
    "status": "active",
    "tour_title": "Custom",
    "service_type": "Transportation",
    "pricing_model": "flat",
    "product_id_live": null,
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/tours/",
    "description_one_liner": "Custom transportation: $50 base per booking. Staff must confirm route and final quote before payment.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT017-R2",
    "language": "en",
    "status": "active",
    "tour_title": "Mountain Biking - Cable Car and Waterfalls Route",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_VHISKIAPc1ibr9",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Mountain Biking cable car and waterfalls route: $50 per person; 10 km round trip, cable car and two waterfalls included.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT017-R2",
    "language": "es",
    "status": "active",
    "tour_title": "Ciclismo - Ruta del Teleférico y Cascadas",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_VHISKIAPc1ibr9",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$50.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Mountain Biking cable car and waterfalls route: $50 per person; 10 km round trip, cable car and two waterfalls included.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT017-BF",
    "language": "en",
    "status": "active",
    "tour_title": "Mountain Biking - Optional Butterfly Garden Admission",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6EC5jW6ndT675",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Optional Butterfly Garden admission with the $20 Mountain Biking route: $10.00 per person.",
    "use_inline_price": true
  },
  {
    "tour_code": "ACT017-BF",
    "language": "es",
    "status": "active",
    "tour_title": "Ciclismo - Entrada Opcional al Mariposario",
    "service_type": "guided_activity",
    "pricing_model": "per_person",
    "product_id_live": "prod_U6EC5jW6ndT675",
    "price_id_live": null,
    "product_id_test": null,
    "price_id_test": null,
    "currency": "USD",
    "amount_display": "$10.00",
    "min_person": 1,
    "max_person": "unlimited",
    "duration_label": "Staff confirmed itinerary",
    "pickup_time_local": "",
    "dropoff_time_local": "",
    "pickup_window_minutes": 15,
    "timezone": "America/Guayaquil",
    "hero_image_url": "",
    "tour_page_url": "https://mindobirdwatching.com/activities/",
    "description_one_liner": "Optional Butterfly Garden admission with the $20 Mountain Biking route: $10.00 per person.",
    "use_inline_price": true
  }
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function text(msg, status = 200) {
  return new Response(msg, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
}

function requiredString(v, field) {
  if (!v || typeof v !== "string" || !v.trim()) throw new Error(`Missing ${field}`);
  return v.trim();
}

function requiredInt(v, field) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`Invalid ${field}`);
  return n;
}

function optionalString(v) {
  return typeof v === "string" ? v.trim() : "";
}

function optionalBoolean(v) {
  if (v === true || v === 1) return true;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.trim().toLowerCase());
  return false;
}

function firstNonEmptyString(...values) {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function resolveTourIdsStrict(tour, isTest) {
  const product_id = isTest ? tour.product_id_test : tour.product_id_live;
  const price_id = isTest ? tour.price_id_test : tour.price_id_live;
  return { product_id: product_id || null, price_id: price_id || null };
}

async function setInvoiceItemPriceData(env, isTest, form, item, unitAmountCents) {
  form.set("price_data[currency]", String(item.tour.currency || "USD").toLowerCase());
  let productId = item.ids.product_id;
  if (!productId) {
    const productForm = new URLSearchParams();
    productForm.set("name", `${item.tour_code} ${item.tour.tour_title}`);
    productForm.set("metadata[tour_code]", item.tour_code);
    productForm.set("metadata[tour_title]", item.tour.tour_title || "");
    productForm.set("metadata[stripe_environment]", isTest ? "sandbox" : "live");
    const product = await stripeRequest(env, isTest, "POST", "/v1/products", productForm);
    productId = product.id;
  }
  form.set("price_data[product]", productId);
  form.set("price_data[unit_amount]", String(unitAmountCents));
}

function findTour(tour_code, language) {
  return TOURS.find((t) => t.status === "active" && t.tour_code === tour_code && t.language === language);
}

function isFlatPriced(tour) {
  return ["flat", "flat_amount"].includes(String(tour && tour.pricing_model || "per_person").toLowerCase());
}

function stripeLineQuantity(tour, numberOfPeople, quadCount) {
  if (tour && tour.pricing_model === "per_quad") return requiredInt(quadCount, "quad_count");
  return isFlatPriced(tour) ? 1 : numberOfPeople;
}

function validatedQuadCount(tour, guests, rawCount) {
  const count = requiredInt(rawCount, "quad_count");
  if (Number(tour.max_guests_per_quad) > 0 && guests > count * Number(tour.max_guests_per_quad)) throw new Error("Guest count exceeds the capacity of the selected quads.");
  return count;
}

function calculatedLineTotalCents(tour, unitAmountCents, numberOfPeople, quadCount) {
  return unitAmountCents * stripeLineQuantity(tour, numberOfPeople, quadCount);
}

function getStripeKey(env, isTest) {
  return (isTest ? env.STRIPE_SECRET_KEY_TEST : env.STRIPE_SECRET_KEY) || null;
}

function parseAmountDisplayToCents(amountDisplay) {
  const n = Number(String(amountDisplay || "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function optionalWholeDollarAmount(v, allowSigned = false) {
  if (v === undefined || v === null || v === "") return null;

  const n = Number(v);
  if (!Number.isFinite(n) || !Number.isInteger(n) || (!allowSigned && n <= 0)) {
    throw new Error(allowSigned ? "Invalid price adjustment. Use a whole-dollar amount." : "Invalid final price. Use a whole-dollar amount greater than 0.");
  }

  return n;
}

function dollarsToDisplay(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

async function stripeRequest(env, isTest, method, path, formBody) {
  const key = getStripeKey(env, isTest);
  if (!key) throw new Error("Stripe secret key not configured");

  const init = { method, headers: { Authorization: `Bearer ${key}` } };

  if (method !== "GET") {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = formBody;
  }

  const res = await fetch(`https://api.stripe.com${path}`, init);
  const txt = await res.text();
  let data;
  try {
    data = JSON.parse(txt);
  } catch {
    data = { raw: txt };
  }

  if (!res.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : `Stripe API error (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

function validInternalId(value, prefix) {
  const id = String(value || "").trim();
  if (!id) return "";
  if (!new RegExp(`^${prefix}-[A-Za-z0-9_-]+$`).test(id)) {
    throw new Error(`Invalid ${prefix.toLowerCase()} identifier.`);
  }
  return id;
}

async function syncRevenueAttribution(env, payload) {
  const inquiryId = String(payload && payload.inquiry_id || "").trim();
  const invoiceId = String(payload && payload.invoice_id || "").trim();
  if (!inquiryId || !invoiceId) {
    return { ok: false, skipped: true, error: "inquiry_or_invoice_id_missing" };
  }

  if (!env.CF_SHARED_SECRET) {
    console.log("Revenue attribution sync skipped: CF_SHARED_SECRET is not configured on the Stripe Worker.");
    return { ok: false, skipped: true, error: "shared_secret_missing" };
  }

  const endpoint = env.ATTRIBUTION_LINK_URL || "https://mindobirdwatching.com/api/attribution/link";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.CF_SHARED_SECRET}`,
      },
      body: JSON.stringify({
        inquiry_id: inquiryId,
        guest_id: String(payload.guest_id || "").trim(),
        booking_id: String(payload.booking_id || "").trim(),
        quote_id: String(payload.quote_id || "").trim(),
        invoice_id: invoiceId,
        payment_method: "stripe",
      }),
    });

    const responseText = await response.text();
    let responseData = null;
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch {
      responseData = null;
    }

    if (!response.ok || !responseData || !responseData.ok) {
      console.log("Revenue attribution sync failed", {
        inquiry_id: inquiryId,
        invoice_id: invoiceId,
        status: response.status,
        response: responseText,
      });
      return {
        ok: false,
        status: response.status,
        error: responseData && responseData.error ? responseData.error : "attribution_link_failed",
      };
    }

    console.log("Revenue attribution linked", {
      inquiry_id: inquiryId,
      invoice_id: invoiceId,
      attribution_link_id: responseData.attribution_link_id || "",
    });
    return {
      ok: true,
      status: response.status,
      attribution_link_id: responseData.attribution_link_id || "",
    };
  } catch (error) {
    console.log("Revenue attribution sync error", {
      inquiry_id: inquiryId,
      invoice_id: invoiceId,
      error: String(error && error.message ? error.message : error),
    });
    return { ok: false, error: "attribution_link_request_failed" };
  }
}

async function lookupCrmInquiry(env, inquiryId) {
  if (!inquiryId) return null;
  const endpoint = env.CRM_API_URL || "https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api";
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ payload: JSON.stringify({ action: "list_inquiries" }) }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const records = Array.isArray(data) ? data : (data.records || data.data || data.inquiries || []);
    return records.find((record) => String(record && record.inquiry_id || "") === inquiryId) || null;
  } catch {
    return null;
  }
}

async function postCrmLedgerAction(env, action, recordKey, record) {
  if (!record || !String(record.inquiry_id || "").trim() || !String(record.guest_id || "").trim()) {
    return { ok: false, skipped: true, error: "ledger_identity_missing" };
  }
  const endpoint = env.CRM_API_URL || "https://n8n.mindobirdwatching.com/webhook/mbw-crm-admin-api";
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
      body: new URLSearchParams({ payload: JSON.stringify({ action, [recordKey]: record, record }) }),
    });
    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!response.ok || !data || data.ok === false) {
      console.log("CRM ledger sync failed", { action, status: response.status, response: raw.slice(0, 500) });
      return { ok: false, status: response.status, error: data && data.error ? data.error : "crm_ledger_sync_failed" };
    }
    return { ok: true, data };
  } catch (error) {
    console.log("CRM ledger sync error", { action, error: String(error && error.message ? error.message : error) });
    return { ok: false, error: "crm_ledger_request_failed" };
  }
}

async function syncCrmInvoiceLedger(env, payload) {
  const inquiryId = String(payload.inquiry_id || "").trim();
  const guestId = String(payload.guest_id || "").trim();
  const invoiceId = String(payload.invoice_id || "").trim();
  if (!inquiryId || !guestId || !invoiceId) return { ok: false, skipped: true, error: "ledger_identity_missing" };
  const bookingId = String(payload.booking_id || "").trim() || `B-${inquiryId.replace(/^INQ-/, "")}`;
  const total = Number(payload.total_booking_price || 0);
  const paid = Number(payload.total_amount_paid || 0);
  const remaining = Math.max(0, payload.balance_remaining == null ? total - paid : Number(payload.balance_remaining || 0));
  const fullyPaid = remaining <= 0.005 && paid > 0;
  const booking = {
    booking_id: bookingId,
    inquiry_id: inquiryId,
    guest_id: guestId,
    booking_status: fullyPaid ? "confirmed" : "payment_pending",
    tour_date_start: payload.tour_date_start || "",
    tour_date_end: payload.tour_date_end || payload.tour_date_start || "",
    tour_date_text: payload.tour_date_text || payload.tour_date_start || "",
    party_size: payload.party_size || "",
    service_type: payload.service_type || "",
    product_selected: payload.product_selected || "",
    pickup_location: payload.pickup_location || "",
    total_booking_price: total,
    quoted_currency: payload.currency || "USD",
    deposit_required: payload.deposit_required || "No",
    source_system: "stripe_invoice",
    source_key: invoiceId,
    invoice_no: payload.invoice_no || "",
    tour_key: payload.tour_key || "",
    is_archived: "No",
  };
  const payment = {
    payment_id: `PAY-${invoiceId}`,
    booking_id: bookingId,
    inquiry_id: inquiryId,
    guest_id: guestId,
    payment_status: fullyPaid ? "paid" : paid > 0 ? "partial" : "unpaid",
    payment_date: payload.payment_date || "",
    payment_method: "Stripe",
    paid_to: "Mindo Bird Watching",
    invoice_no: payload.invoice_no || "",
    invoice_id: invoiceId,
    transaction_id: payload.transaction_id || "",
    total_booking_price: total,
    deposit_amount_paid: Number(payload.deposit_amount_paid || 0),
    additional_amount_paid: Number(payload.additional_amount_paid || 0),
    total_amount_paid: paid,
    balance_remaining: remaining,
    is_fully_paid: fullyPaid ? "Yes" : "No",
    notes: payload.notes || "Automatically synchronized from Stripe invoice lifecycle.",
  };
  const [bookingResult, paymentResult] = await Promise.all([
    postCrmLedgerAction(env, "upsert_booking", "booking", booking),
    postCrmLedgerAction(env, "upsert_payment", "payment", payment),
  ]);
  return { ok: !!bookingResult.ok && !!paymentResult.ok, booking: bookingResult, payment: paymentResult };
}

async function findAvailableDeposit(env, isTest, inquiryId) {
  const query = `metadata['inquiry_id']:'${inquiryId}' AND metadata['payment_purpose']:'tour_deposit' AND status:'succeeded'`;
  const result = await stripeRequest(
    env,
    isTest,
    "GET",
    `/v1/payment_intents/search?limit=20&query=${encodeURIComponent(query)}&expand[]=data.customer&expand[]=data.latest_charge`,
    null,
  );
  const deposits = (result.data || [])
    .filter((pi) => !String(pi.metadata && pi.metadata.applied_invoice_id || "").trim())
    .sort((a, b) => Number(b.created || 0) - Number(a.created || 0));
  return deposits[0] || null;
}

async function validateDepositForInvoice(env, isTest, paymentIntentId, inquiryId, currency) {
  if (!paymentIntentId) return null;
  const pi = await stripeRequest(
    env,
    isTest,
    "GET",
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=customer&expand[]=latest_charge`,
    null,
  );
  if (pi.status !== "succeeded") throw new Error("The selected deposit has not succeeded.");
  if (String(pi.currency || "").toLowerCase() !== String(currency || "usd").toLowerCase()) {
    throw new Error("Deposit currency does not match the invoice currency.");
  }
  const md = pi.metadata || {};
  if (inquiryId && md.inquiry_id && String(md.inquiry_id) !== inquiryId) {
    throw new Error("Deposit belongs to a different CRM inquiry.");
  }
  if (md.applied_invoice_id) throw new Error("This deposit is already applied to an invoice.");
  return pi;
}

async function createHistoricalDepositCredit(env, isTest, customerId, deposit, currency, inquiryId, guestId) {
  if (!deposit || deposit.customer) return;
  const amountCents = Number(deposit.amount_received || deposit.amount || 0);
  if (!amountCents) throw new Error("Historical deposit amount is missing.");
  const form = new URLSearchParams();
  form.set("customer", customerId);
  form.set("amount", String(-amountCents));
  form.set("currency", String(currency || deposit.currency || "usd").toLowerCase());
  form.set("description", `Deposit previously paid (${deposit.id})`);
  form.set("metadata[payment_purpose]", "tour_deposit");
  form.set("metadata[deposit_application_method]", "historical_invoice_credit");
  form.set("metadata[deposit_payment_intent_id]", deposit.id);
  if (inquiryId) form.set("metadata[inquiry_id]", inquiryId);
  if (guestId) form.set("metadata[guest_id]", guestId);
  await stripeRequest(env, isTest, "POST", "/v1/invoiceitems", form);
}

async function attachDepositToInvoice(env, isTest, invoice, deposit, inquiryId, guestId) {
  if (!deposit) return invoice;
  if (Number(deposit.amount_received || deposit.amount || 0) > Number(invoice.amount_due || 0)) {
    if (deposit.customer) throw new Error("Deposit exceeds the invoice amount. Review this booking manually.");
  }
  if (deposit.customer) {
    const attachForm = new URLSearchParams();
    attachForm.set("payment_intent", deposit.id);
    await stripeRequest(env, isTest, "POST", `/v1/invoices/${encodeURIComponent(invoice.id)}/attach_payment`, attachForm);
  }

  const metadataForm = new URLSearchParams();
  metadataForm.set("metadata[applied_invoice_id]", invoice.id);
  metadataForm.set("metadata[applied_invoice_no]", invoice.number || "");
  metadataForm.set("metadata[applied_at]", new Date().toISOString());
  metadataForm.set("metadata[deposit_status]", "applied");
  metadataForm.set(
    "metadata[deposit_application_method]",
    deposit.customer ? "stripe_attach_payment" : "historical_invoice_credit",
  );
  if (inquiryId) metadataForm.set("metadata[inquiry_id]", inquiryId);
  if (guestId) metadataForm.set("metadata[guest_id]", guestId);
  await stripeRequest(env, isTest, "POST", `/v1/payment_intents/${encodeURIComponent(deposit.id)}`, metadataForm);

  return await stripeRequest(
    env,
    isTest,
    "GET",
    `/v1/invoices/${encodeURIComponent(invoice.id)}?expand[]=customer&expand[]=payments&expand[]=payments.data.payment.payment_intent`,
    null,
  );
}

async function verifyTurnstileIfConfigured(env, token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: "Missing Turnstile token" };

  const form = new URLSearchParams();
  form.set("secret", env.TURNSTILE_SECRET_KEY);
  form.set("response", token);
  if (ip) form.set("remoteip", ip);

  const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  const data = await r.json();
  if (!data.success) return { ok: false, error: "Turnstile failed" };
  return { ok: true, skipped: false };
}

async function verifyStripeSignature(payload, signatureHeader, webhookSecrets) {
  const parts = signatureHeader.split(",").map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  if (!tPart || !v1Part) throw new Error("Invalid Stripe-Signature header");

  const timestamp = tPart.split("=")[1];
  const signature = v1Part.split("=")[1];
  const signedPayload = `${timestamp}.${payload}`;

  for (const secret of webhookSecrets) {
    if (!secret) continue;
    const expected = await hmacSha256Hex(secret, signedPayload);
    if (timingSafeEqual(signature, expected)) {
      return JSON.parse(payload);
    }
  }

  throw new Error("Bad signature");
}

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return bufToHex(sig);
}

function bufToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

function normalizeStripeEnv(v) {
  const s = (typeof v === "string" ? v : "").toLowerCase().trim();
  return s === "live" ? "live" : "sandbox";
}

function formatDateNY(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (t) => {
    const p = parts.find((x) => x.type === t);
    return p ? p.value : "";
  };

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatISOInNY(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (t) => {
    const p = parts.find((x) => x.type === t);
    return p ? p.value : "";
  };

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")} ET`;
}

function splitName(fullName) {
  const s = (fullName || "").trim();
  if (!s) return { first: "", last: "" };
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

function centsToDollarsString(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return (n / 100).toFixed(2);
}

function splitFeeProportionally(totalFeeCents, lineAmountsCents) {
  const totalFee = Number(totalFeeCents || 0);
  const amounts = Array.isArray(lineAmountsCents) ? lineAmountsCents.map((n) => Number(n || 0)) : [];
  const subtotal = amounts.reduce((sum, n) => sum + n, 0);
  if (!totalFee || !subtotal || !amounts.length) return amounts.map(() => 0);

  const raw = amounts.map((amount) => (totalFee * amount) / subtotal);
  const rounded = raw.map((v) => Math.floor(v));
  let remainder = totalFee - rounded.reduce((sum, n) => sum + n, 0);

  const order = raw
    .map((value, idx) => ({ idx, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);

  let i = 0;
  while (remainder > 0 && order.length) {
    rounded[order[i % order.length].idx] += 1;
    remainder -= 1;
    i += 1;
  }

  return rounded;
}

function isAccountingServiceLine(line) {
  const item = line || {};
  const md = item.metadata || {};
  const amountCents = Number(item.amount || 0);
  if (!(amountCents > 0)) return false;
  return Boolean(md.item_index || md.tour_code || md.tour_title || md.service_type);
}

function buildTourKey(invoiceId, itemIndex, tourCode, tourDate, quantity) {
  return [invoiceId || "", itemIndex || "", tourCode || "", tourDate || "", quantity || ""].join("|");
}

function toAgentActivitySheetFields(fields) {
  const eventDate = (() => {
    const iso = String(fields.created_at_iso || "");
    const m = iso.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : "";
  })();

  const agentIdRaw = fields.agent_id != null ? String(fields.agent_id) : "";

  return {
    created_at_iso: fields.created_at_iso || "",
    event_date: eventDate,
    event_type: fields.event_type || fields.action_type || "",
    booking_session_id: fields.booking_session_id || "",
    status: fields.status || "",
    agent_id: agentIdRaw,
    agent_name: fields.agent_name || "",
    source_page: fields.source_page || "",
    booking_mode: fields.booking_mode || "",
    stripe_environment: fields.stripe_environment || "",
    action_channel: fields.action_channel || "",
    link_type: fields.link_type || "",
    invoice_id: fields.invoice_id || "",
    invoice_no: fields.invoice_no || fields.invoice_number || "",
    payment_link_url: fields.payment_link_url || "",
    hosted_invoice_url: fields.hosted_invoice_url || "",
    total_items: fields.total_items || "",
    itinerary_summary: fields.itinerary_summary || fields.items_summary || "",
    amount_expected: fields.amount_expected || fields.total_amount || "",
    guest_first_name: fields.guest_first_name || "",
    guest_last_name: fields.guest_last_name || "",
    guest_email: fields.guest_email || "",
    guest_phone: fields.guest_phone || "",
    pickup_location_label: fields.pickup_location_label || "",
    pickup_address_or_hotel: fields.pickup_address_or_hotel || "",
    notes: fields.notes || "",
    whatsapp_number: fields.whatsapp_number || "",
    tour_code: fields.tour_code || "",
    tour_title: fields.tour_title || "",
    tour_date: fields.tour_date || "",
    language: fields.language || "",
    party_size: fields.party_size || "",
    service_type: fields.service_type || "",
    currency: fields.currency || "",
    stripe_payment_intent: fields.stripe_payment_intent || "",
    stripe_charge_id: fields.stripe_charge_id || "",
    stripe_receipt_url: fields.stripe_receipt_url || "",
    worker_event_id: fields.worker_event_id || fields.stripe_event_id || "",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJsonWithRetry({
  url,
  body,
  errorPrefix,
  attempts = 3,
  retryDelayMs = 800,
}) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const txt = await res.text();
      let data;
      try {
        data = JSON.parse(txt);
      } catch {
        data = { raw: txt };
      }

      if (!res.ok) {
        const msg = data && data.error ? data.error : `${errorPrefix} (${res.status})`;
        throw new Error(msg);
      }

      if (data && data.ok === false) {
        throw new Error(data.error || `${errorPrefix} returned ok:false`);
      }

      return data;
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  throw lastError || new Error(`${errorPrefix} failed after retries`);
}

async function postToSheetsLogger(env, payloadObj) {
  if (!env.GSHEET_WEBAPP_URL) return { ok: false, skipped: true, reason: "GSHEET_WEBAPP_URL not set" };

  const hasToken = !!env.GSHEET_WEBAPP_TOKEN;
  const url = hasToken ? `${env.GSHEET_WEBAPP_URL}?token=${encodeURIComponent(env.GSHEET_WEBAPP_TOKEN)}` : env.GSHEET_WEBAPP_URL;

  return await postJsonWithRetry({
    url,
    body: payloadObj,
    errorPrefix: "Sheets logger error",
    attempts: 3,
    retryDelayMs: 800,
  });
}

async function postToAgentActivityLogger(env, payloadObj) {
  if (!env.AGENT_ACTIVITY_WEBAPP_URL) return { ok: false, skipped: true, reason: "AGENT_ACTIVITY_WEBAPP_URL not set" };

  const hasToken = !!env.AGENT_ACTIVITY_WEBAPP_TOKEN;
  const url = hasToken
    ? `${env.AGENT_ACTIVITY_WEBAPP_URL}?token=${encodeURIComponent(env.AGENT_ACTIVITY_WEBAPP_TOKEN)}`
    : env.AGENT_ACTIVITY_WEBAPP_URL;

  const sourceFields = payloadObj && payloadObj.fields && typeof payloadObj.fields === "object" ? payloadObj.fields : payloadObj || {};
  const sheetFields = toAgentActivitySheetFields(sourceFields);
  const mergedFields = {
    ...sourceFields,
    ...sheetFields,
  };

  const body = {
    ...mergedFields,
    fields: mergedFields,
  };

  return await postJsonWithRetry({
    url,
    body,
    errorPrefix: "Agent activity logger error",
    attempts: 3,
    retryDelayMs: 800,
  });
}

async function postToBookingConfirmationLogger(env, payloadObj) {
  if (!env.BOOKING_CONFIRMATION_WEBAPP_URL) {
    return { ok: false, skipped: true, reason: "BOOKING_CONFIRMATION_WEBAPP_URL not set" };
  }

  const body = {
    token: env.BOOKING_CONFIRMATION_WEBAPP_TOKEN || "",
    ...payloadObj,
  };

  return await postJsonWithRetry({
    url: env.BOOKING_CONFIRMATION_WEBAPP_URL,
    body,
    errorPrefix: "Booking confirmation logger error",
    attempts: 3,
    retryDelayMs: 800,
  });
}

function buildAgentActivityBase({
  createdAt,
  actionType,
  bookingMode,
  bookingSessionId,
  stripeEnvironment,
  agentId,
  invoiceId,
  invoiceNumber,
  paymentLinkUrl,
  hostedInvoiceUrl,
  guestFirstName,
  guestLastName,
  guestEmail,
  guestPhone,
  pickupLocationLabel,
  pickupAddressOrHotel,
  notes,
}) {
  return {
    created_at_iso: formatISOInNY(createdAt),
    action_type: actionType || "",
    event_type: actionType || "",
    booking_mode: bookingMode || "",
    booking_session_id: bookingSessionId || "",
    stripe_environment: stripeEnvironment || "",
    agent_id: agentId != null ? String(agentId) : "",
    invoice_id: invoiceId || "",
    invoice_number: invoiceNumber || "",
    invoice_no: invoiceNumber || "",
    payment_link_url: paymentLinkUrl || "",
    hosted_invoice_url: hostedInvoiceUrl || "",
    guest_first_name: guestFirstName || "",
    guest_last_name: guestLastName || "",
    guest_email: guestEmail || "",
    guest_phone: guestPhone || "",
    pickup_location_label: pickupLocationLabel || "",
    pickup_address_or_hotel: pickupAddressOrHotel || "",
    notes: notes || "",
    whatsapp_number: "",
    tour_code: "",
    tour_title: "",
    tour_date: "",
    language: "",
    party_size: "",
    service_type: "",
    items_summary: "",
    itinerary_summary: "",
    total_items: "",
    total_amount: "",
    amount_expected: "",
    currency: "",
    status: "",
    agent_name: "",
    source_page: "/book-tour/create/",
    action_channel: "internal_tool",
    link_type: actionType === "payment_link_generated" ? "payment_link" : actionType.indexOf("invoice") !== -1 ? "invoice" : "",
  };
}

function appendActivityItemSummary(base, items) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalAmountCents = safeItems.reduce((sum, item) => sum + Number(item.amount_cents || 0), 0);

  const summary = safeItems
    .map((item) => {
      return [
        item.tour_code || "",
        item.tour_title || "",
        item.tour_date || "",
        item.language || "",
        item.quantity || "",
      ].join(":");
    })
    .join(" | ");

  base.items_summary = summary;
  base.itinerary_summary = summary;
  base.total_items = String(safeItems.length);
  base.total_amount = centsToDollarsString(totalAmountCents);
  base.amount_expected = base.total_amount;
  base.currency = safeItems.length ? (safeItems[0].currency || "USD") : "";

  if (safeItems.length === 1) {
    const item = safeItems[0] || {};
    base.tour_code = item.tour_code || "";
    base.tour_title = item.tour_title || "";
    base.tour_date = item.tour_date || "";
    base.language = item.language || "";
    base.party_size = item.quantity != null ? String(item.quantity) : "";
    base.service_type = item.service_type || "";
  }

  return base;
}

async function enrichChargeAndFees(env, isTest, paymentIntentId) {
  const out = {
    stripe_charge_id: "",
    stripe_receipt_url: "",
    transaction_fee_total: "",
    transaction_fee_total_cents: 0,
  };

  if (!paymentIntentId) return out;

  const pi = await stripeRequest(env, isTest, "GET", `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=latest_charge`, null);

  let chargeObj = null;
  if (pi && pi.latest_charge) {
    if (typeof pi.latest_charge === "string") {
      chargeObj = await stripeRequest(env, isTest, "GET", `/v1/charges/${encodeURIComponent(pi.latest_charge)}?expand[]=balance_transaction`, null);
    } else {
      chargeObj = pi.latest_charge;
      if (chargeObj && chargeObj.id && typeof chargeObj.balance_transaction === "string") {
        chargeObj = await stripeRequest(env, isTest, "GET", `/v1/charges/${encodeURIComponent(chargeObj.id)}?expand[]=balance_transaction`, null);
      }
    }
  }

  if (chargeObj) {
    out.stripe_charge_id = chargeObj.id || "";
    out.stripe_receipt_url = chargeObj.receipt_url || "";

    const bt = chargeObj.balance_transaction;
    if (bt && typeof bt === "object" && bt.fee != null) {
      out.transaction_fee_total_cents = Number(bt.fee || 0);
      out.transaction_fee_total = centsToDollarsString(bt.fee);
    }
  }

  return out;
}

function getInvoicePaymentIntentId(inv, eventObj) {
  const eventPaymentIntentId =
    eventObj &&
    eventObj.object === "invoice_payment" &&
    eventObj.payment &&
    eventObj.payment.payment_intent
      ? String(eventObj.payment.payment_intent)
      : "";

  if (eventPaymentIntentId) return eventPaymentIntentId;

  const invoicePaymentIntentId =
    inv && inv.payment_intent && typeof inv.payment_intent === "string"
      ? inv.payment_intent
      : inv && inv.payment_intent && inv.payment_intent.id
        ? inv.payment_intent.id
        : "";

  if (invoicePaymentIntentId) return invoicePaymentIntentId;

  const payments = inv && inv.payments && Array.isArray(inv.payments.data) ? inv.payments.data : [];
  for (const invoicePayment of payments) {
    const payment = invoicePayment && invoicePayment.payment ? invoicePayment.payment : null;
    if (!payment) continue;

    if (typeof payment.payment_intent === "string" && payment.payment_intent) {
      return payment.payment_intent;
    }

    if (payment.payment_intent && payment.payment_intent.id) {
      return payment.payment_intent.id;
    }

    if (payment.type === "payment_intent" && typeof payment.id === "string" && payment.id.startsWith("pi_")) {
      return payment.id;
    }
  }

  return "";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const routePrefix = "/stripe";
    const path = url.pathname.startsWith(routePrefix + "/") ? url.pathname.slice(routePrefix.length) : url.pathname;

    if (path === "/" && request.method === "GET") {
      return text("MBW Stripe Worker is running. version=v43-jewels-nightwalk-sandbox-2026-10-05", 200);
    }

    if (path === "/api/tours" && request.method === "GET") {
      const lang = (url.searchParams.get("lang") || "en").toLowerCase();
      const tours = TOURS.filter((t) => t.status === "active" && t.language === lang).map((t) => ({
        tour_code: t.tour_code,
        language: t.language,
        tour_title: t.tour_title,
        currency: t.currency,
        amount_display: t.amount_display,
        pricing_model: t.pricing_model || "per_person",
        duration_label: t.duration_label,
        pickup_time_local: t.pickup_time_local,
        pickup_window_minutes: t.pickup_window_minutes,
        timezone: t.timezone,
        hero_image_url: t.hero_image_url,
        tour_page_url: t.tour_page_url,
        description_one_liner: t.description_one_liner,
        min_person: t.min_person,
        max_person: t.max_person,
        max_guests_per_quad: t.max_guests_per_quad || null,
      }));
      return new Response(JSON.stringify({ ok: true, tours }, null, 2), {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    if (path === "/api/deposits/available" && request.method === "GET") {
      try {
        const inquiryId = validInternalId(url.searchParams.get("inquiry_id"), "INQ");
        const paymentIntentId = optionalString(url.searchParams.get("payment_intent_id"));
        if (!inquiryId && !paymentIntentId) {
          return json({ ok: false, error: "Missing inquiry_id or payment_intent_id" }, 400);
        }
        if (paymentIntentId && !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) {
          return json({ ok: false, error: "Invalid Stripe PaymentIntent ID" }, 400);
        }
        const stripeEnv = normalizeStripeEnv(url.searchParams.get("stripe_environment"));
        const isTest = stripeEnv !== "live";
        const deposit = paymentIntentId
          ? await stripeRequest(
              env,
              isTest,
              "GET",
              `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?expand[]=customer&expand[]=latest_charge`,
              null,
            )
          : await findAvailableDeposit(env, isTest, inquiryId);
        if (!deposit) return json({ ok: true, found: false, inquiry_id: inquiryId }, 200);
        if (deposit.status !== "succeeded") {
          return json({ ok: false, error: "The entered PaymentIntent has not succeeded." }, 400);
        }
        const depositMetadata = deposit.metadata || {};
        if (depositMetadata.applied_invoice_id) {
          return json({ ok: false, error: "This deposit is already applied to an invoice." }, 400);
        }
        if (inquiryId && depositMetadata.inquiry_id && String(depositMetadata.inquiry_id) !== inquiryId) {
          return json({ ok: false, error: "This deposit belongs to a different CRM inquiry." }, 400);
        }
        const crm = await lookupCrmInquiry(env, inquiryId);
        return json({
          ok: true,
          found: true,
          inquiry_id: inquiryId,
          guest_id: crm && crm.guest_id ? String(crm.guest_id) : String(depositMetadata.guest_id || ""),
          payment_intent_id: deposit.id,
          stripe_customer_id: typeof deposit.customer === "string" ? deposit.customer : (deposit.customer && deposit.customer.id || ""),
          can_apply: true,
          application_method: deposit.customer ? "stripe_attach_payment" : "historical_invoice_credit",
          eligibility_message: deposit.customer
            ? "This deposit will be attached to the invoice as a Stripe payment."
            : "This historical deposit will be shown as a credit on the invoice.",
          amount: Number(deposit.amount_received || deposit.amount || 0) / 100,
          currency: String(deposit.currency || "usd").toUpperCase(),
          created_at: new Date(Number(deposit.created || 0) * 1000).toISOString(),
          deposit_status: String(depositMetadata.deposit_status || (paymentIntentId ? "historical_verified" : "available")),
        }, 200);
      } catch (err) {
        return json({ ok: false, error: err.message || "Deposit lookup failed" }, 400);
      }
    }

    if (path === "/api/retry" && request.method === "GET") {
      const token = (url.searchParams.get("token") || "").trim();
      if (!token) return json({ ok: false, error: "Missing token" }, 400);
      if (!env.RETRY_KV) return json({ ok: false, error: "RETRY_KV not configured" }, 400);
      const val = await env.RETRY_KV.get(`retry:${token}`);
      if (!val) return json({ ok: false, error: "Not found" }, 404);
      return json({ ok: true, url: val }, 200);
    }

    if (path === "/api/retry-redirect" && request.method === "GET") {
      const token = (url.searchParams.get("token") || "").trim();
      if (!token) return text("Missing token", 400);
      if (!env.RETRY_KV) return Response.redirect("https://mindobirdwatching.com/book-tour/pay/", 302);
      const val = await env.RETRY_KV.get(`retry:${token}`);
      if (!val) return Response.redirect("https://mindobirdwatching.com/book-tour/pay/", 302);
      return Response.redirect(val, 302);
    }

    if (path === "/api/agent-activity" && request.method === "GET") {
      return json({ ok: true, message: "agent activity endpoint is live" }, 200);
    }

    if (path === "/test-agent-log" && request.method === "GET") {
      try {
        const createdAt = new Date();
        const fields = buildAgentActivityBase({
          createdAt,
          actionType: "worker_test",
          bookingMode: "test",
          bookingSessionId: "manual-test",
          stripeEnvironment: "sandbox",
          agentId: "test",
          invoiceId: "",
          invoiceNumber: "",
          paymentLinkUrl: "",
          hostedInvoiceUrl: "",
          guestFirstName: "Worker",
          guestLastName: "Test",
          guestEmail: "test@example.com",
          guestPhone: "",
          pickupLocationLabel: "Test",
          pickupAddressOrHotel: "Test",
          notes: "Manual agent activity logger test from /stripe/test-agent-log",
        });

        fields.status = "ok";
        fields.agent_name = "Worker Test";
        fields.total_items = "0";
        fields.itinerary_summary = "manual_test";
        fields.items_summary = "manual_test";
        fields.amount_expected = "0.00";
        fields.total_amount = "0.00";
        fields.currency = "USD";

        const logger_result = await postToAgentActivityLogger(env, { fields });
        return json({ ok: true, test: "agent_activity", logger_result }, 200);
      } catch (err) {
        return json({ ok: false, test: "agent_activity", error: err.message || "Unknown error" }, 500);
      }
    }

    if (path === "/debug" && request.method === "GET") {
      return json({
        ok: true,
        worker_version: "mbw-stripe-v39-multi-invoice-ledger",
        stripe_mode_default: env.STRIPE_SECRET_KEY_TEST ? "sandbox" : env.STRIPE_SECRET_KEY ? "live" : "not_configured",
        agent_activity_webapp_configured: !!env.AGENT_ACTIVITY_WEBAPP_URL,
        agent_activity_token_configured: !!env.AGENT_ACTIVITY_WEBAPP_TOKEN,
        booking_confirmation_webapp_configured: !!env.BOOKING_CONFIRMATION_WEBAPP_URL,
        booking_confirmation_token_configured: !!env.BOOKING_CONFIRMATION_WEBAPP_TOKEN,
        stripe_invoices_webapp_configured: !!env.GSHEET_WEBAPP_URL,
        stripe_invoices_token_configured: !!env.GSHEET_WEBAPP_TOKEN,
        retry_kv_configured: !!env.RETRY_KV,
        turnstile_configured: !!env.TURNSTILE_SECRET_KEY,
        webhook_test_configured: !!env.STRIPE_WEBHOOK_SECRET_TEST,
        webhook_live_configured: !!env.STRIPE_WEBHOOK_SECRET,
      }, 200);
    }

    if (path === "/api/agent-activity" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      try {
        const actionType = optionalString(body.action_type || body.event_type);
        if (!actionType) throw new Error("Missing action_type or event_type");

        const createdAt = new Date();
        const fields = buildAgentActivityBase({
          createdAt,
          actionType,
          bookingMode: optionalString(body.booking_mode),
          bookingSessionId: optionalString(body.booking_session_id),
          stripeEnvironment: normalizeStripeEnv(body.stripe_environment),
          agentId: optionalString(body.agent_id),
          invoiceId: optionalString(body.invoice_id),
          invoiceNumber: optionalString(body.invoice_number || body.invoice_no),
          paymentLinkUrl: optionalString(body.payment_link_url),
          hostedInvoiceUrl: optionalString(body.hosted_invoice_url),
          guestFirstName: optionalString(body.guest_first_name),
          guestLastName: optionalString(body.guest_last_name),
          guestEmail: optionalString(body.guest_email),
          guestPhone: optionalString(body.guest_phone),
          pickupLocationLabel: optionalString(body.pickup_location_label),
          pickupAddressOrHotel: optionalString(body.pickup_address_or_hotel),
          notes: optionalString(body.notes),
        });

        const rawItems = Array.isArray(body.items) ? body.items : [];
        appendActivityItemSummary(fields, rawItems.map((item) => ({
          tour_code: optionalString(item.tour_code),
          tour_title: optionalString(item.tour_title),
          tour_date: optionalString(item.tour_date),
          language: optionalString(item.language),
          quantity: item.quantity != null ? String(item.quantity) : "",
          amount_cents: Number(item.amount_cents || 0),
          currency: optionalString(item.currency || "USD"),
        })));

        fields.status = optionalString(body.status) || "logged";

        const result = await postToAgentActivityLogger(env, { fields });
        return json({ ok: true, result }, 200);
      } catch (err) {
        return json({ ok: false, error: err.message || "Unknown error" }, 400);
      }
    }

    if (path === "/api/create-checkout-session" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      try {
        const language = requiredString(body.language, "language").toLowerCase();
        const tour_code = requiredString(body.tour_code, "tour_code");
        const number_of_people = requiredInt(body.number_of_people, "number_of_people");
        const main_name = requiredString(body.main_contact_name, "main_contact_name");
        const main_email = requiredString(body.main_contact_email, "main_contact_email");
        const main_phone = requiredString(body.main_contact_phone, "main_contact_phone");
        const whatsapp_number = requiredString(body.whatsapp_number, "whatsapp_number");
        const pickup_location_label = requiredString(body.pickup_location_label, "pickup_location_label");
        const pickup_address_or_hotel = requiredString(body.pickup_address_or_hotel, "pickup_address_or_hotel");
        const notes = optionalString(body.notes);
        const tour_date = requiredString(body.tour_date, "tour_date");
        const agent_id = firstNonEmptyString(body.agent_id, body.agentId, body.agentID);
        const guestFirstName = firstNonEmptyString(
          body.guest_first_name,
          body.guestFirstName,
          body.main_contact_first_name,
          body.mainContactFirstName,
          body.main_contact_firstname,
          body.mainContactFirstname,
          splitName(main_name).first,
        );
        const guestLastName = firstNonEmptyString(
          body.guest_last_name,
          body.guestLastName,
          body.main_contact_last_name,
          body.mainContactLastName,
          body.main_contact_lastname,
          body.mainContactLastname,
          splitName(main_name).last,
        );

        const ip = request.headers.get("CF-Connecting-IP") || "";
        const ts = await verifyTurnstileIfConfigured(env, body.turnstile_token, ip);
        if (!ts.ok) return json({ ok: false, error: ts.error }, 400);

        const stripeEnv = normalizeStripeEnv(body.stripe_environment);
        const isTest = stripeEnv !== "live";
        const tour = findTour(tour_code, language);
        if (!tour) throw new Error("Tour not found for selected language");
        const quad_count = tour.pricing_model === "per_quad" ? validatedQuadCount(tour, number_of_people, body.quad_count) : null;
        if (Number(tour.max_person) > 0 && number_of_people > Number(tour.max_person)) throw new Error(`Maximum ${tour.max_person} people allowed`);

        const ids = resolveTourIdsStrict(tour, isTest);
        if (!ids.product_id) throw new Error(`Stripe product mapping is required for ${tour_code} before selling it.`);
        if (!tour.use_inline_price && !ids.price_id) throw new Error("Tour price_id is not configured for this environment");
        if (!ids.product_id) throw new Error("Tour product_id is not configured for this environment");
        if (tour.min_person && number_of_people < Number(tour.min_person)) throw new Error(`Minimum ${tour.min_person} people required`);

        const successUrl = language === "es"
          ? `https://mindobirdwatching.com/es/reservar-tour/pago/exito/?session_id={CHECKOUT_SESSION_ID}&env=${encodeURIComponent(stripeEnv)}`
          : `https://mindobirdwatching.com/book-tour/pay/success/?session_id={CHECKOUT_SESSION_ID}&env=${encodeURIComponent(stripeEnv)}`;

        const retryToken = randomToken();
        const cancelQs =
          `retry=${encodeURIComponent(retryToken)}` +
          `&tour=${encodeURIComponent(tour_code)}` +
          `&date=${encodeURIComponent(tour_date)}` +
          `&party=${encodeURIComponent(String(number_of_people))}` +
          `&lang=${encodeURIComponent(language)}` +
          `&env=${encodeURIComponent(stripeEnv)}` +
          (agent_id ? `&agent_id=${encodeURIComponent(agent_id)}` : "");

        const cancelUrl = language === "es"
          ? `https://mindobirdwatching.com/es/reservar-tour/pago/cancelado/?${cancelQs}`
          : `https://mindobirdwatching.com/book-tour/pay/cancel/?${cancelQs}`;

        const form = new URLSearchParams();
        form.set("mode", "payment");
        form.set("success_url", successUrl);
        form.set("cancel_url", cancelUrl);
        if (tour.use_inline_price) {
          form.set("line_items[0][price_data][currency]", String(tour.currency || "USD").toLowerCase());
          form.set("line_items[0][price_data][product]", ids.product_id);
          form.set("line_items[0][price_data][unit_amount]", String(parseAmountDisplayToCents(tour.amount_display)));
        } else {
          form.set("line_items[0][price]", ids.price_id);
        }
        form.set("line_items[0][quantity]", String(stripeLineQuantity(tour, number_of_people, quad_count)));
        form.set("customer_email", main_email);
        form.set("payment_intent_data[receipt_email]", main_email);
        form.set("client_reference_id", `${tour_code}-${tour_date}-${main_email}`);

        const md = {
          tour_code: tour.tour_code,
          language,
          tour_title: tour.tour_title,
          service_type: tour.service_type || "",
          pricing_model: tour.pricing_model || "per_person",
          product_id: ids.product_id,
          price_id: tour.use_inline_price ? "" : ids.price_id,
          number_of_people: String(number_of_people),
          quad_count: quad_count === null ? "" : String(quad_count),
          main_contact_name: main_name,
          main_contact_email: main_email,
          main_contact_phone: main_phone,
          guest_first_name: guestFirstName,
          guest_last_name: guestLastName,
          whatsapp_number,
          pickup_location_label,
          pickup_address_or_hotel,
          notes,
          tour_date,
          pickup_time_local: tour.pickup_time_local,
          pickup_window_minutes: String(tour.pickup_window_minutes || 15),
          timezone: tour.timezone || "America/Guayaquil",
          retry_token: retryToken,
          stripe_environment: stripeEnv,
          agent_id,
        };

        Object.keys(md).forEach((k) => {
          const v = md[k];
          if (v !== undefined && v !== null) form.set(`metadata[${k}]`, String(v));
        });
        Object.keys(md).forEach((k) => {
          const v = md[k];
          if (v !== undefined && v !== null) form.set(`payment_intent_data[metadata][${k}]`, String(v));
        });
        form.set("payment_intent_data[description]", `${tour_code} ${tour.tour_title} (${number_of_people} pax) ${tour_date}`);

        const session = await stripeRequest(env, isTest, "POST", "/v1/checkout/sessions", form);

        if (env.RETRY_KV && session && session.url) {
          ctx.waitUntil(env.RETRY_KV.put(`retry:${retryToken}`, session.url, { expirationTtl: 60 * 60 * 24 * 2 }));
        }

        let agentActivityResult = null;
        let agentActivityError = "";
        try {
          const createdAt = new Date();
          const base = buildAgentActivityBase({
            createdAt,
            actionType: "payment_link_generated",
            bookingMode: "single_item",
            bookingSessionId: session.id || "",
            stripeEnvironment: stripeEnv,
            agentId: agent_id,
            invoiceId: "",
            invoiceNumber: "",
            paymentLinkUrl: session.url || "",
            hostedInvoiceUrl: "",
            guestFirstName,
            guestLastName,
            guestEmail: main_email,
            guestPhone: main_phone,
            pickupLocationLabel: pickup_location_label,
            pickupAddressOrHotel: pickup_address_or_hotel,
            notes,
          });

          appendActivityItemSummary(base, [{
            tour_code: tour.tour_code,
            tour_title: tour.tour_title,
            tour_date,
            language,
            quantity: String(number_of_people),
            amount_cents: calculatedLineTotalCents(tour, parseAmountDisplayToCents(tour.amount_display), number_of_people, quad_count),
            currency: tour.currency || "USD",
            service_type: tour.service_type || "",
          }]);

          base.status = "generated";
          agentActivityResult = await postToAgentActivityLogger(env, { fields: base });
          console.log("Agent activity logged: payment_link_generated", JSON.stringify(agentActivityResult));
        } catch (err) {
          agentActivityError = String(err && err.message ? err.message : err);
          console.log("Agent activity logging failed for payment_link_generated", { error: agentActivityError });
        }

        return json({ ok: true, url: session.url, id: session.id, retry_token: retryToken, env: stripeEnv, agent_activity_logged: !!(agentActivityResult && agentActivityResult.ok), agent_activity_error: agentActivityError }, 200);
      } catch (err) {
        return json({ ok: false, error: err.message || "Unknown error" }, 400);
      }
    }

    if (path === "/api/create-invoice" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      try {
        const language = requiredString(body.language, "language").toLowerCase();
        const tour_code = requiredString(body.tour_code, "tour_code");
        const number_of_people = requiredInt(body.number_of_people, "number_of_people");
        const main_name = requiredString(body.main_contact_name, "main_contact_name");
        const main_email = requiredString(body.main_contact_email, "main_contact_email");
        const main_phone = requiredString(body.main_contact_phone, "main_contact_phone");
        const whatsapp_number = requiredString(body.whatsapp_number, "whatsapp_number");
        const pickup_location_label = requiredString(body.pickup_location_label, "pickup_location_label");
        const pickup_address_or_hotel = requiredString(body.pickup_address_or_hotel, "pickup_address_or_hotel");
        const notes = optionalString(body.notes);
        const tour_date = requiredString(body.tour_date, "tour_date");
        const agent_id = firstNonEmptyString(body.agent_id, body.agentId, body.agentID);
        const guestFirstName = firstNonEmptyString(
          body.guest_first_name,
          body.guestFirstName,
          body.main_contact_first_name,
          body.mainContactFirstName,
          body.main_contact_firstname,
          body.mainContactFirstname,
          splitName(main_name).first,
        );
        const guestLastName = firstNonEmptyString(
          body.guest_last_name,
          body.guestLastName,
          body.main_contact_last_name,
          body.mainContactLastName,
          body.main_contact_lastname,
          body.mainContactLastname,
          splitName(main_name).last,
        );
        const dueDaysRaw = body.invoice_due_days != null ? Number(body.invoice_due_days) : 1;
        const invoice_due_days = Number.isFinite(dueDaysRaw) && dueDaysRaw > 0 ? Math.floor(dueDaysRaw) : 1;
        const price_override_per_person = optionalWholeDollarAmount(body.price_override_per_person);
        const price_adjustment_per_person = optionalWholeDollarAmount(body.price_adjustment_per_person, true);
        const pricing_reason = optionalString(body.pricing_reason);
        const pricing_notes = optionalString(body.pricing_notes);
        const inquiry_id = validInternalId(body.inquiry_id, "INQ");
        const guest_id = validInternalId(body.guest_id, "G");
        const booking_id = optionalString(body.booking_id);
        const quote_id = optionalString(body.quote_id);
        const deposit_payment_intent_id = optionalString(body.deposit_payment_intent_id);
        const minimum_party_override = optionalBoolean(body.minimum_party_override);
        const minimum_party_override_reason = optionalString(body.minimum_party_override_reason);

        if (price_override_per_person !== null && !pricing_reason) {
          throw new Error("Pricing reason is required when using a price override.");
        }

        const stripeEnv = normalizeStripeEnv(body.stripe_environment);
        const isTest = stripeEnv !== "live";
        const tour = findTour(tour_code, language);
        if (!tour) throw new Error("Tour not found for selected language");
        const quad_count = tour.pricing_model === "per_quad" ? validatedQuadCount(tour, number_of_people, body.quad_count) : null;
        if (Number(tour.max_person) > 0 && number_of_people > Number(tour.max_person)) throw new Error(`Maximum ${tour.max_person} people allowed`);
        const deposit = await validateDepositForInvoice(env, isTest, deposit_payment_intent_id, inquiry_id, tour.currency || "USD");

        const ids = resolveTourIdsStrict(tour, isTest);
        if (!ids.product_id) throw new Error(`Stripe product mapping is required for ${tour_code} before selling it.`);
        const minimumPartySize = Number(tour.min_person || 0);
        const isBelowMinimum = Boolean(minimumPartySize && number_of_people < minimumPartySize);
        if (isBelowMinimum && !minimum_party_override) {
          throw new Error(`Minimum ${minimumPartySize} people required`);
        }
        if (isBelowMinimum && minimum_party_override_reason !== "staff_confirmed_single_guest") {
          throw new Error("A valid minimum-party override reason is required.");
        }

        const standardPriceCents = parseAmountDisplayToCents(tour.amount_display);
        const overridePriceCents = price_override_per_person !== null
          ? Math.round(price_override_per_person * 100)
          : null;
        const invoiceUnitAmountCents = overridePriceCents !== null ? overridePriceCents : standardPriceCents;
        const priceAdjustmentCents = overridePriceCents !== null
          ? overridePriceCents - standardPriceCents
          : 0;
        const providedAdjustmentCents = price_adjustment_per_person !== null
          ? Math.round(price_adjustment_per_person * 100)
          : priceAdjustmentCents;
        if (providedAdjustmentCents !== priceAdjustmentCents) throw new Error("Price adjustment does not match the standard and final price.");

        if (!invoiceUnitAmountCents) throw new Error("Unable to resolve invoice unit amount.");
        const expectedInvoiceCents = calculatedLineTotalCents(tour, invoiceUnitAmountCents, number_of_people, quad_count);
        if (deposit && Number(deposit.amount_received || deposit.amount || 0) > expectedInvoiceCents) {
          throw new Error("Deposit exceeds the invoice amount. Review this booking manually.");
        }

        const md = {
          tour_code: tour.tour_code,
          language,
          tour_title: tour.tour_title,
          service_type: tour.service_type || "",
          pricing_model: tour.pricing_model || "per_person",
          product_id: ids.product_id,
          price_id: tour.use_inline_price ? "" : ids.price_id,
          number_of_people: String(number_of_people),
          quad_count: quad_count === null ? "" : String(quad_count),
          main_contact_name: main_name,
          main_contact_email: main_email,
          main_contact_phone: main_phone,
          whatsapp_number,
          pickup_location_label,
          pickup_address_or_hotel,
          notes,
          tour_date,
          pickup_time_local: tour.pickup_time_local,
          pickup_window_minutes: String(tour.pickup_window_minutes || 15),
          timezone: tour.timezone || "America/Guayaquil",
          stripe_environment: stripeEnv,
          agent_id,
          standard_price_per_person: dollarsToDisplay(standardPriceCents / 100),
          price_adjustment_per_person: overridePriceCents !== null ? dollarsToDisplay(providedAdjustmentCents / 100) : "",
          final_price_per_person: dollarsToDisplay(invoiceUnitAmountCents / 100),
          price_override_per_person: overridePriceCents !== null ? dollarsToDisplay(overridePriceCents / 100) : "",
          pricing_reason,
          pricing_notes,
          pricing_mode: overridePriceCents !== null ? "override" : "standard",
          inquiry_id,
          guest_id,
          booking_id,
          quote_id,
          minimum_party_override: isBelowMinimum && minimum_party_override ? "true" : "false",
          minimum_party_override_reason: isBelowMinimum ? minimum_party_override_reason : "",
          minimum_party_original: isBelowMinimum ? String(minimumPartySize) : "",
          actual_party_size: String(number_of_people),
          deposit_payment_intent_id: deposit ? deposit.id : "",
          deposit_applied_amount: deposit ? dollarsToDisplay(Number(deposit.amount_received || deposit.amount || 0) / 100) : "",
          deposit_payment_method: deposit ? "Stripe" : "",
          deposit_application_method: deposit
            ? (deposit.customer ? "stripe_attach_payment" : "historical_invoice_credit")
            : "",
          stripe_customer_id: deposit && deposit.customer
            ? (typeof deposit.customer === "string" ? deposit.customer : deposit.customer.id || "")
            : "",
        };

        let customer = deposit && deposit.customer ? deposit.customer : null;
        if (typeof customer === "string") {
          customer = await stripeRequest(env, isTest, "GET", `/v1/customers/${encodeURIComponent(customer)}`, null);
        }
        if (!customer || !customer.id) {
          const custForm = new URLSearchParams();
          custForm.set("email", main_email);
          custForm.set("name", main_name);
          custForm.set("phone", main_phone);
          Object.keys(md).forEach((k) => {
            const v = md[k];
            if (v !== undefined && v !== null) custForm.set(`metadata[${k}]`, String(v));
          });
          customer = await stripeRequest(env, isTest, "POST", "/v1/customers", custForm);
        }

        const itemForm = new URLSearchParams();
        itemForm.set("customer", customer.id);
        if (tour.use_inline_price || overridePriceCents !== null || !ids.price_id) {
          await setInvoiceItemPriceData(env, isTest, itemForm, { tour, tour_code, ids }, invoiceUnitAmountCents);
        } else {
          itemForm.set("pricing[price]", ids.price_id);
        }
        itemForm.set("quantity", String(stripeLineQuantity(tour, number_of_people, quad_count)));
        itemForm.set("description", `${tour_code} ${tour.tour_title} (${number_of_people} pax) ${tour_date}`);
        Object.keys(md).forEach((k) => {
          const v = md[k];
          if (v !== undefined && v !== null) itemForm.set(`metadata[${k}]`, String(v));
        });
        await stripeRequest(env, isTest, "POST", "/v1/invoiceitems", itemForm);
        await createHistoricalDepositCredit(
          env,
          isTest,
          customer.id,
          deposit,
          tour.currency || "USD",
          inquiry_id,
          guest_id,
        );

        const invForm = new URLSearchParams();
        invForm.set("customer", customer.id);
        invForm.set("collection_method", "send_invoice");
        invForm.set("days_until_due", String(invoice_due_days));
        invForm.set("auto_advance", "true");
        invForm.set("pending_invoice_items_behavior", "include");
        Object.keys(md).forEach((k) => {
          const v = md[k];
          if (v !== undefined && v !== null) invForm.set(`metadata[${k}]`, String(v));
        });
        const invoice = await stripeRequest(env, isTest, "POST", "/v1/invoices", invForm);

        let finalized = await stripeRequest(env, isTest, "POST", `/v1/invoices/${encodeURIComponent(invoice.id)}/finalize`, new URLSearchParams());
        finalized = await attachDepositToInvoice(env, isTest, finalized, deposit, inquiry_id, guest_id);
        if (!isTest) {
          await stripeRequest(env, isTest, "POST", `/v1/invoices/${encodeURIComponent(invoice.id)}/send`, new URLSearchParams());
        }

        let agentActivityResult = null;
        let agentActivityError = "";
        try {
          const createdAt = new Date();
          const base = buildAgentActivityBase({
            createdAt,
            actionType: "invoice_sent",
            bookingMode: "single_item",
            bookingSessionId: "",
            stripeEnvironment: stripeEnv,
            agentId: agent_id,
            invoiceId: finalized.id || "",
            invoiceNumber: finalized.number || "",
            paymentLinkUrl: "",
            hostedInvoiceUrl: finalized.hosted_invoice_url || "",
            guestFirstName: "",
            guestLastName: "",
            guestEmail: main_email,
            guestPhone: main_phone,
            pickupLocationLabel: pickup_location_label,
            pickupAddressOrHotel: pickup_address_or_hotel,
            notes,
          });

          appendActivityItemSummary(base, [{
            tour_code: tour.tour_code,
            tour_title: tour.tour_title,
            tour_date,
            language,
            quantity: String(number_of_people),
            amount_cents: Number(finalized.amount_due || 0),
            currency: (finalized.currency || "usd").toUpperCase(),
            service_type: tour.service_type || "",
          }]);

          base.status = finalized.status || "open";
          agentActivityResult = await postToAgentActivityLogger(env, { fields: base });
          console.log("Agent activity logged: invoice_sent single", JSON.stringify(agentActivityResult));
        } catch (err) {
          agentActivityError = String(err && err.message ? err.message : err);
          console.log("Agent activity logging failed for invoice_sent", { error: agentActivityError });
        }

        const attributionLinkResult = await syncRevenueAttribution(env, {
          inquiry_id,
          guest_id,
          booking_id,
          quote_id,
          invoice_id: finalized.id || "",
        });
        const crmLedgerResult = await syncCrmInvoiceLedger(env, {
          inquiry_id, guest_id, booking_id,
          invoice_id: finalized.id || "",
          invoice_no: finalized.number || "",
          total_booking_price: expectedInvoiceCents / 100,
          deposit_amount_paid: deposit ? Number(deposit.amount_received || deposit.amount || 0) / 100 : 0,
          total_amount_paid: deposit ? Number(deposit.amount_received || deposit.amount || 0) / 100 : 0,
          balance_remaining: Number(finalized.amount_remaining || 0) / 100,
          tour_date_start: tour_date,
          tour_date_end: tour_date,
          party_size: number_of_people,
          service_type: tour.service_type || "",
          product_selected: tour.tour_code || "",
          pickup_location: pickup_location_label || pickup_address_or_hotel || "",
          currency: (finalized.currency || "usd").toUpperCase(),
          notes: "Stripe invoice created; payment status will update from the paid webhook.",
        });

        return json({
          ok: true,
          invoice_id: finalized.id,
          invoice_number: finalized.number || "",
          hosted_invoice_url: finalized.hosted_invoice_url || "",
          invoice_pdf: finalized.invoice_pdf || "",
          customer_email: main_email,
          inquiry_id,
          guest_id,
          booking_id,
          quote_id,
          minimum_party_override: isBelowMinimum && minimum_party_override,
          minimum_party_override_reason: isBelowMinimum ? minimum_party_override_reason : "",
          deposit_applied_amount: deposit ? Number(deposit.amount_received || deposit.amount || 0) / 100 : 0,
          deposit_payment_intent_id: deposit ? deposit.id : "",
          stripe_customer_id: customer.id,
          amount_before_deposit: expectedInvoiceCents / 100,
          amount_remaining: Number(finalized.amount_remaining || 0) / 100,
          env: stripeEnv,
          agent_activity_logged: !!(agentActivityResult && agentActivityResult.ok),
          agent_activity_error: agentActivityError,
          attribution_linked: !!attributionLinkResult.ok,
          attribution_link_id: attributionLinkResult.attribution_link_id || "",
          attribution_link_error: attributionLinkResult.ok ? "" : (attributionLinkResult.error || "attribution_link_failed"),
          crm_ledger_linked: !!crmLedgerResult.ok,
        }, 200);
      } catch (err) {
        return json({ ok: false, error: err.message || "Unknown error" }, 400);
      }
    }

    if (path === "/api/create-invoice-multi" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "Invalid JSON body" }, 400);
      }

      try {
        const stripeEnv = normalizeStripeEnv(body.stripe_environment);
        const isTest = stripeEnv !== "live";
        const main_name = requiredString(body.main_contact_name, "main_contact_name");
        const main_email = requiredString(body.main_contact_email, "main_contact_email");
        const main_phone = requiredString(body.main_contact_phone, "main_contact_phone");
        const whatsapp_number = requiredString(body.whatsapp_number, "whatsapp_number");
        const pickup_location_label = requiredString(body.pickup_location_label, "pickup_location_label");
        const pickup_address_or_hotel = requiredString(body.pickup_address_or_hotel, "pickup_address_or_hotel");
        const notes = optionalString(body.notes);
        const agent_id = optionalString(body.agent_id);
        const inquiry_id = validInternalId(body.inquiry_id, "INQ");
        const guest_id = validInternalId(body.guest_id, "G");
        const booking_id = optionalString(body.booking_id);
        const quote_id = optionalString(body.quote_id);
        const deposit_payment_intent_id = optionalString(body.deposit_payment_intent_id);
        const minimum_party_override = optionalBoolean(body.minimum_party_override);
        const minimum_party_override_reason = optionalString(body.minimum_party_override_reason);
        const dueDaysRaw = body.invoice_due_days != null ? Number(body.invoice_due_days) : 1;
        const invoice_due_days = Number.isFinite(dueDaysRaw) && dueDaysRaw > 0 ? Math.floor(dueDaysRaw) : 1;

        const items = Array.isArray(body.items) ? body.items : [];
        if (!items.length) throw new Error("At least one invoice item is required");

        const normalizedItems = items.map((raw, index) => {
          const language = requiredString(raw.language, `items[${index}].language`).toLowerCase();
          const tour_code = requiredString(raw.tour_code, `items[${index}].tour_code`);
          const quantity = requiredInt(raw.quantity, `items[${index}].quantity`);
          const tour_date = requiredString(raw.tour_date, `items[${index}].tour_date`);
          const item_notes = optionalString(raw.item_notes);
          const price_override_per_person = optionalWholeDollarAmount(raw.price_override_per_person);
          const price_adjustment_per_person = optionalWholeDollarAmount(raw.price_adjustment_per_person, true);
          const pricing_reason = optionalString(raw.pricing_reason);
          const pricing_notes = optionalString(raw.pricing_notes);
          if (price_override_per_person !== null && !pricing_reason) {
            throw new Error(`Item ${index + 1}: pricing reason is required when using a price override.`);
          }

          const tour = findTour(tour_code, language);
          if (!tour) throw new Error(`Tour not found for item ${index + 1}`);

          const ids = resolveTourIdsStrict(tour, isTest);
        if (!ids.product_id) throw new Error(`Stripe product mapping is required for ${tour_code} before selling it.`);
          const quad_count = tour.pricing_model === "per_quad" ? validatedQuadCount(tour, quantity, raw.quad_count) : null;
          if (Number(tour.max_person) > 0 && quantity > Number(tour.max_person)) throw new Error(`Item ${index + 1}: maximum ${tour.max_person} people allowed`);
          const minimumPartySize = Number(tour.min_person || 0);
          const isBelowMinimum = Boolean(minimumPartySize && quantity < minimumPartySize);
          if (isBelowMinimum && !minimum_party_override) {
            throw new Error(`Item ${index + 1}: minimum ${minimumPartySize} people required`);
          }
          if (isBelowMinimum && minimum_party_override_reason !== "staff_confirmed_single_guest") {
            throw new Error(`Item ${index + 1}: a valid minimum-party override reason is required.`);
          }

          const standardPriceCents = parseAmountDisplayToCents(tour.amount_display);
          const overridePriceCents = price_override_per_person !== null
            ? Math.round(price_override_per_person * 100)
            : null;
          const unitAmountCents = overridePriceCents !== null ? overridePriceCents : standardPriceCents;
          const priceAdjustmentCents = overridePriceCents !== null
            ? overridePriceCents - standardPriceCents
            : 0;
          const providedAdjustmentCents = price_adjustment_per_person !== null
            ? Math.round(price_adjustment_per_person * 100)
            : priceAdjustmentCents;
          if (providedAdjustmentCents !== priceAdjustmentCents) throw new Error(`Item ${index + 1}: price adjustment does not match the standard and final price.`);

          if (!unitAmountCents) throw new Error(`Item ${index + 1}: unable to resolve invoice unit amount.`);

          return {
            index,
            language,
            tour_code,
            quantity,
            quad_count,
            tour_date,
            item_notes,
            tour,
            ids,
            unitAmountCents,
            standardPriceCents,
            overridePriceCents,
            providedAdjustmentCents,
            pricing_reason,
            pricing_notes,
            minimumPartySize,
            isBelowMinimum,
          };
        });

        const belowMinimumItems = normalizedItems.filter((item) => item.isBelowMinimum);
        const minimumPartyOverrideSummary = belowMinimumItems
          .map((item) => `${item.index + 1}:${item.tour_code}:${item.quantity}/${item.minimumPartySize}`)
          .join(" | ");

        const itinerary_summary = normalizedItems.map((item) => `${item.tour_code}:${item.quantity}:${item.tour_date}:${item.language}`).join(" | ");
        const invoiceCurrency = normalizedItems[0].tour.currency || "USD";
        if (normalizedItems.some((item) => String(item.tour.currency || "USD").toLowerCase() !== String(invoiceCurrency).toLowerCase())) {
          throw new Error("All invoice items must use the same currency.");
        }
        const deposit = await validateDepositForInvoice(env, isTest, deposit_payment_intent_id, inquiry_id, invoiceCurrency);
        const expectedInvoiceCents = normalizedItems.reduce(
          (sum, item) => sum + calculatedLineTotalCents(item.tour, item.unitAmountCents, item.quantity, item.quad_count),
          0,
        );
        if (deposit && Number(deposit.amount_received || deposit.amount || 0) > expectedInvoiceCents) {
          throw new Error("Deposit exceeds the invoice amount. Review this booking manually.");
        }

        const custMd = {
          stripe_environment: stripeEnv,
          booking_mode: "multi_item",
          itinerary_summary,
          main_contact_name: main_name,
          main_contact_email: main_email,
          main_contact_phone: main_phone,
          whatsapp_number,
          pickup_location_label,
          pickup_address_or_hotel,
          notes,
          agent_id,
          inquiry_id,
          guest_id,
          booking_id,
          quote_id,
          minimum_party_override: belowMinimumItems.length && minimum_party_override ? "true" : "false",
          minimum_party_override_reason: belowMinimumItems.length ? minimum_party_override_reason : "",
          minimum_party_override_items: minimumPartyOverrideSummary,
          deposit_payment_intent_id: deposit ? deposit.id : "",
          deposit_applied_amount: deposit ? dollarsToDisplay(Number(deposit.amount_received || deposit.amount || 0) / 100) : "",
          deposit_payment_method: deposit ? "Stripe" : "",
          deposit_application_method: deposit
            ? (deposit.customer ? "stripe_attach_payment" : "historical_invoice_credit")
            : "",
        };

        let customer = deposit && deposit.customer ? deposit.customer : null;
        if (typeof customer === "string") {
          customer = await stripeRequest(env, isTest, "GET", `/v1/customers/${encodeURIComponent(customer)}`, null);
        }
        if (!customer || !customer.id) {
          const custForm = new URLSearchParams();
          custForm.set("email", main_email);
          custForm.set("name", main_name);
          custForm.set("phone", main_phone);
          Object.keys(custMd).forEach((k) => {
            const v = custMd[k];
            if (v !== undefined && v !== null && v !== "") custForm.set(`metadata[${k}]`, String(v));
          });
          customer = await stripeRequest(env, isTest, "POST", "/v1/customers", custForm);
        }

        for (const item of normalizedItems) {
          const lineMd = {
            stripe_environment: stripeEnv,
            booking_mode: "multi_item",
            item_index: String(item.index + 1),
            tour_code: item.tour_code,
            language: item.language,
            tour_title: item.tour.tour_title,
            service_type: item.tour.service_type || "",
            pricing_model: item.tour.pricing_model || "per_person",
            product_id: item.ids.product_id,
            price_id: item.tour.use_inline_price ? "" : item.ids.price_id,
            number_of_people: String(item.quantity),
            quad_count: item.quad_count === null ? "" : String(item.quad_count),
            main_contact_name: main_name,
            main_contact_email: main_email,
            main_contact_phone: main_phone,
            whatsapp_number,
            pickup_location_label,
            pickup_address_or_hotel,
            notes,
            item_notes: item.item_notes,
            tour_date: item.tour_date,
            pickup_time_local: item.tour.pickup_time_local || "",
            pickup_window_minutes: String(item.tour.pickup_window_minutes || 15),
            timezone: item.tour.timezone || "America/Guayaquil",
            agent_id,
            standard_price_per_person: dollarsToDisplay(item.standardPriceCents / 100),
            price_adjustment_per_person: item.overridePriceCents !== null ? dollarsToDisplay(item.providedAdjustmentCents / 100) : "",
            final_price_per_person: dollarsToDisplay(item.unitAmountCents / 100),
            price_override_per_person: item.overridePriceCents !== null ? dollarsToDisplay(item.overridePriceCents / 100) : "",
            pricing_reason: item.pricing_reason,
            pricing_notes: item.pricing_notes,
            pricing_mode: item.overridePriceCents !== null ? "override" : "standard",
            inquiry_id,
            guest_id,
            booking_id,
            quote_id,
            minimum_party_override: item.isBelowMinimum && minimum_party_override ? "true" : "false",
            minimum_party_override_reason: item.isBelowMinimum ? minimum_party_override_reason : "",
            minimum_party_original: item.isBelowMinimum ? String(item.minimumPartySize) : "",
            actual_party_size: String(item.quantity),
          };

          const itemForm = new URLSearchParams();
          itemForm.set("customer", customer.id);
          if (item.tour.use_inline_price || item.overridePriceCents !== null || !item.ids.price_id) {
            await setInvoiceItemPriceData(env, isTest, itemForm, item, item.unitAmountCents);
          } else {
            itemForm.set("pricing[price]", item.ids.price_id);
          }
          itemForm.set("quantity", String(stripeLineQuantity(item.tour, item.quantity, item.quad_count)));
          const descriptionBase = `${item.tour_code} ${item.tour.tour_title} (${item.quantity} pax) ${item.tour_date}`;
          itemForm.set("description", item.item_notes ? `${descriptionBase} | Notes: ${item.item_notes}` : descriptionBase);
          Object.keys(lineMd).forEach((k) => {
            const v = lineMd[k];
            if (v !== undefined && v !== null && v !== "") itemForm.set(`metadata[${k}]`, String(v));
          });
          await stripeRequest(env, isTest, "POST", "/v1/invoiceitems", itemForm);
        }

        await createHistoricalDepositCredit(
          env,
          isTest,
          customer.id,
          deposit,
          invoiceCurrency,
          inquiry_id,
          guest_id,
        );

        const invMd = {
          stripe_environment: stripeEnv,
          booking_mode: "multi_item",
          itinerary_summary,
          main_contact_name: main_name,
          main_contact_email: main_email,
          main_contact_phone: main_phone,
          whatsapp_number,
          pickup_location_label,
          pickup_address_or_hotel,
          notes,
          total_items: String(normalizedItems.length),
          agent_id,
          inquiry_id,
          guest_id,
          booking_id,
          quote_id,
          minimum_party_override: belowMinimumItems.length && minimum_party_override ? "true" : "false",
          minimum_party_override_reason: belowMinimumItems.length ? minimum_party_override_reason : "",
          minimum_party_override_items: minimumPartyOverrideSummary,
          deposit_payment_intent_id: deposit ? deposit.id : "",
          deposit_applied_amount: deposit ? dollarsToDisplay(Number(deposit.amount_received || deposit.amount || 0) / 100) : "",
          deposit_payment_method: deposit ? "Stripe" : "",
          deposit_application_method: deposit
            ? (deposit.customer ? "stripe_attach_payment" : "historical_invoice_credit")
            : "",
          stripe_customer_id: customer.id,
        };

        const invForm = new URLSearchParams();
        invForm.set("customer", customer.id);
        invForm.set("collection_method", "send_invoice");
        invForm.set("days_until_due", String(invoice_due_days));
        invForm.set("auto_advance", "true");
        invForm.set("pending_invoice_items_behavior", "include");
        Object.keys(invMd).forEach((k) => {
          const v = invMd[k];
          if (v !== undefined && v !== null && v !== "") invForm.set(`metadata[${k}]`, String(v));
        });
        const invoice = await stripeRequest(env, isTest, "POST", "/v1/invoices", invForm);

        let finalized = await stripeRequest(env, isTest, "POST", `/v1/invoices/${encodeURIComponent(invoice.id)}/finalize`, new URLSearchParams());
        finalized = await attachDepositToInvoice(env, isTest, finalized, deposit, inquiry_id, guest_id);
        if (!isTest) {
          await stripeRequest(env, isTest, "POST", `/v1/invoices/${encodeURIComponent(invoice.id)}/send`, new URLSearchParams());
        }

        let agentActivityResult = null;
        let agentActivityError = "";
        try {
          const createdAt = new Date();
          const base = buildAgentActivityBase({
            createdAt,
            actionType: "invoice_sent",
            bookingMode: "multi_item",
            bookingSessionId: "",
            stripeEnvironment: stripeEnv,
            agentId: agent_id,
            invoiceId: finalized.id || "",
            invoiceNumber: finalized.number || "",
            paymentLinkUrl: "",
            hostedInvoiceUrl: finalized.hosted_invoice_url || "",
            guestFirstName: "",
            guestLastName: "",
            guestEmail: main_email,
            guestPhone: main_phone,
            pickupLocationLabel: pickup_location_label,
            pickupAddressOrHotel: pickup_address_or_hotel,
            notes,
          });

          appendActivityItemSummary(base, normalizedItems.map((item) => ({
            tour_code: item.tour_code,
            tour_title: item.tour.tour_title,
            tour_date: item.tour_date,
            language: item.language,
            quantity: String(item.quantity),
            amount_cents: calculatedLineTotalCents(item.tour, item.unitAmountCents, item.quantity, item.quad_count),
            currency: item.tour.currency || "USD",
            service_type: item.tour.service_type || "",
          })));

          base.status = finalized.status || "open";
          agentActivityResult = await postToAgentActivityLogger(env, { fields: base });
          console.log("Agent activity logged: invoice_sent multi", JSON.stringify(agentActivityResult));
        } catch (err) {
          agentActivityError = String(err && err.message ? err.message : err);
          console.log("Agent activity logging failed for multi invoice_sent", { error: agentActivityError });
        }

        const attributionLinkResult = await syncRevenueAttribution(env, {
          inquiry_id,
          guest_id,
          booking_id,
          quote_id,
          invoice_id: finalized.id || "",
        });
        const orderedDates = normalizedItems.map(item => item.tour_date).filter(Boolean).sort();
        const crmLedgerResult = await syncCrmInvoiceLedger(env, {
          inquiry_id, guest_id, booking_id,
          invoice_id: finalized.id || "",
          invoice_no: finalized.number || "",
          total_booking_price: expectedInvoiceCents / 100,
          deposit_amount_paid: deposit ? Number(deposit.amount_received || deposit.amount || 0) / 100 : 0,
          total_amount_paid: deposit ? Number(deposit.amount_received || deposit.amount || 0) / 100 : 0,
          balance_remaining: Number(finalized.amount_remaining || 0) / 100,
          tour_date_start: orderedDates[0] || "",
          tour_date_end: orderedDates[orderedDates.length - 1] || "",
          party_size: Math.max(...normalizedItems.map(item => Number(item.quantity || 0)), 0),
          service_type: "Multi Item",
          product_selected: normalizedItems.map(item => item.tour_code).filter(Boolean).join(" | "),
          pickup_location: pickup_location_label || pickup_address_or_hotel || "",
          currency: (finalized.currency || "usd").toUpperCase(),
          notes: "Multi-item Stripe invoice created; payment status will update from the paid webhook.",
        });

        return json({
          ok: true,
          message: isTest ? "Multi-item invoice created in sandbox." : "Multi-item invoice created and email sent.",
          invoice_id: finalized.id,
          invoice_number: finalized.number || "",
          invoice_status: finalized.status || "",
          hosted_invoice_url: finalized.hosted_invoice_url || "",
          invoice_pdf: finalized.invoice_pdf || "",
          customer_email: main_email,
          inquiry_id,
          guest_id,
          booking_id,
          quote_id,
          minimum_party_override: belowMinimumItems.length > 0 && minimum_party_override,
          minimum_party_override_reason: belowMinimumItems.length ? minimum_party_override_reason : "",
          minimum_party_override_items: minimumPartyOverrideSummary,
          deposit_applied_amount: deposit ? Number(deposit.amount_received || deposit.amount || 0) / 100 : 0,
          deposit_payment_intent_id: deposit ? deposit.id : "",
          stripe_customer_id: customer.id,
          amount_before_deposit: expectedInvoiceCents / 100,
          amount_remaining: Number(finalized.amount_remaining || 0) / 100,
          env: stripeEnv,
          total_items: normalizedItems.length,
          agent_activity_logged: !!(agentActivityResult && agentActivityResult.ok),
          agent_activity_error: agentActivityError,
          attribution_linked: !!attributionLinkResult.ok,
          attribution_link_id: attributionLinkResult.attribution_link_id || "",
          attribution_link_error: attributionLinkResult.ok ? "" : (attributionLinkResult.error || "attribution_link_failed"),
          crm_ledger_linked: !!crmLedgerResult.ok,
        }, 200);
      } catch (err) {
        return json({ ok: false, error: err.message || "Unknown error" }, 400);
      }
    }

    if (path === "/api/invoice" && request.method === "GET") {
      try {
        const invoice_id = requiredString(url.searchParams.get("invoice_id") || "", "invoice_id");
        const isTest = normalizeStripeEnv(url.searchParams.get("env")) !== "live";

        const invoice = await stripeRequest(env, isTest, "GET", `/v1/invoices/${encodeURIComponent(invoice_id)}?expand[]=customer&expand[]=lines.data.price&expand[]=payment_intent&expand[]=charge`, null);

        return json({
          ok: true,
          invoice: {
            id: invoice.id || "",
            number: invoice.number || "",
            status: invoice.status || "",
            collection_method: invoice.collection_method || "",
            amount_due: invoice.amount_due != null ? invoice.amount_due : null,
            amount_paid: invoice.amount_paid != null ? invoice.amount_paid : null,
            amount_remaining: invoice.amount_remaining != null ? invoice.amount_remaining : null,
            subtotal: invoice.subtotal != null ? invoice.subtotal : null,
            total: invoice.total != null ? invoice.total : null,
            currency: invoice.currency || "",
            hosted_invoice_url: invoice.hosted_invoice_url || "",
            invoice_pdf: invoice.invoice_pdf || "",
            customer_email: invoice.customer_email || (invoice.customer && invoice.customer.email ? invoice.customer.email : ""),
            metadata: invoice.metadata || {},
            lines: invoice.lines && Array.isArray(invoice.lines.data)
              ? invoice.lines.data.map((line) => ({
                  id: line.id || "",
                  description: line.description || "",
                  amount: line.amount != null ? line.amount : null,
                  quantity: line.quantity != null ? line.quantity : null,
                  currency: line.currency || "",
                  price_id: line.price && line.price.id ? line.price.id : "",
                  price_type: line.price && line.price.type ? line.price.type : "",
                  unit_amount: line.price && line.price.unit_amount != null ? line.price.unit_amount : null,
                  metadata: line.metadata || {},
                }))
              : [],
          },
        }, 200);
      } catch (err) {
        return json({ ok: false, error: err.message || "Unknown error" }, 400);
      }
    }

    if (path === "/api/session" && request.method === "GET") {
      try {
        const session_id = requiredString(url.searchParams.get("session_id") || "", "session_id");
        const isTest = normalizeStripeEnv(url.searchParams.get("env")) !== "live";
        const session = await stripeRequest(env, isTest, "GET", `/v1/checkout/sessions/${session_id}`, null);
        const md = session.metadata || {};

        let stripe_charge_id = "";
        let stripe_receipt_url = "";
        try {
          const paymentIntentId = session.payment_intent || "";
          if (paymentIntentId) {
            const enriched = await enrichChargeAndFees(env, isTest, paymentIntentId);
            stripe_charge_id = enriched.stripe_charge_id || "";
            stripe_receipt_url = enriched.stripe_receipt_url || "";
          }
        } catch (_) {}

        return json({
          ok: true,
          session: {
            id: session.id,
            payment_status: session.payment_status,
            amount_total: session.amount_total,
            currency: session.currency,
            customer_email: session.customer_details && session.customer_details.email ? session.customer_details.email : session.customer_email || null,
            metadata: md,
            stripe_charge_id,
            stripe_receipt_url,
          },
        }, 200);
      } catch (err) {
        return json({ ok: false, error: err.message || "Unknown error" }, 400);
      }
    }

    if (path === "/webhook" && request.method === "POST") {
      const sig = request.headers.get("stripe-signature");
      if (!sig) return text("Missing stripe-signature", 400);

      const payload = await request.text();
      let event;
      try {
        event = await verifyStripeSignature(payload, sig, [env.STRIPE_WEBHOOK_SECRET_TEST, env.STRIPE_WEBHOOK_SECRET]);
      } catch (err) {
        return text(`Webhook signature verification failed: ${err.message}`, 400);
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data && event.data.object ? event.data.object : {};
        const md = session.metadata || {};
        const isTest = !event.livemode;
        const createdAt = new Date((event.created ? Number(event.created) : Math.floor(Date.now() / 1000)) * 1000);
        const metadataFullName = firstNonEmptyString(
          [md.guest_first_name || "", md.guest_last_name || ""].filter(Boolean).join(" "),
          md.main_contact_name || ""
        );
        const customerName = firstNonEmptyString(
          metadataFullName,
          session.customer_details && session.customer_details.name ? session.customer_details.name : ""
        );
        const nameParts = {
          first: firstNonEmptyString(md.guest_first_name, splitName(customerName).first),
          last: firstNonEmptyString(md.guest_last_name, splitName(customerName).last),
        };
        const guestEmail = firstNonEmptyString(md.main_contact_email, session.customer_email || "", session.customer_details && session.customer_details.email ? session.customer_details.email : "");
        const guestPhone = md.main_contact_phone || (session.customer_details && session.customer_details.phone ? session.customer_details.phone : "");
        const amountTotalCents = session.amount_total != null ? Number(session.amount_total) : null;
        let checkoutAgentId = md.agent_id || "";
        const inquiryId = String(session.client_reference_id || md.inquiry_id || "").trim();
        let checkoutGuestId = String(md.guest_id || "").trim();
        const isDeposit = String(md.payment_purpose || "").toLowerCase() === "tour_deposit";

        const fields = {
          created_at_iso: formatISOInNY(createdAt),
          stripe_environment: md.stripe_environment || (event.livemode ? "live" : "sandbox"),
          stripe_event_id: event.id || "",
          stripe_session_id: session.id || "",
          stripe_payment_intent: session.payment_intent || "",
          stripe_charge_id: "",
          stripe_product_id: md.product_id || "",
          stripe_price_id: md.price_id || "",
          stripe_payment_link_id: session.payment_link || "",
          stripe_receipt_url: "",
          invoice_no: "",
          date_paid: formatDateNY(createdAt),
          tour_date: md.tour_date || "",
          tour_completed: "",
          guest_first_name: nameParts.first,
          guest_last_name: nameParts.last,
          guest_email: guestEmail,
          guest_phone: guestPhone,
          home_country: session.customer_details && session.customer_details.address && session.customer_details.address.country ? String(session.customer_details.address.country) : "",
          party_size: md.number_of_people ? String(md.number_of_people) : "",
          service_type: md.service_type || "",
          tour_title: md.tour_title || "",
          tour_guide: "",
          payment_method: "Stripe",
          invoice_id: "",
          transaction_id: session.payment_intent || "",
          product_selected: md.tour_code ? String(md.tour_code) : "",
          guest_rate_override: "",
          discount_rate_guest: "",
          discount_reason: "",
          amount_received: amountTotalCents != null ? centsToDollarsString(amountTotalCents) : "",
          transaction_fee_total: "",
          fee_pct_of_amount_received: "",
          mbw_fee_pct_override: "",
          total_tip_collected: "",
          tip_paid_to_guide_override: "",
          pickup_location: md.pickup_location_label || "",
          pickup_address_or_hotel: md.pickup_address_or_hotel || "",
          other_guests: "",
          notes: md.notes || "",
          month_ky: "",
          guest_rate_per_person: "",
          subtotal_guest: "",
          discount_amount: "",
          final_invoice_total: "",
          expected_total_with_tip: "",
          variance_received_minus_expected: "",
          fee_mode: "",
          default_mbw_fee_pct: "",
          mbw_fee_pct_used: "",
          fees_charged_to_mbw: "",
          fees_charged_to_guide: "",
          guide_pay_model: "",
          guide_base_rate: "",
          guide_base_payout: "",
          guide_tip_pct_used: "",
          tip_paid_to_guide: "",
          tip_paid_to_mbw: "",
          total_amount_owed_to_guide: "",
          mbw_gross_expected: "",
          mbw_gross_actual: "",
          gross_discrepency: "",
          mbw_profit_expected: "",
          mbw_profit_accrual: "",
          net_discrepency: "",
          mbw_profit_margin: "",
          mbw_cash_expected: "",
          mbw_cash_actual: "",
          cash_discrepency: "",
          mbw_cash_profit_margin: "",
          reconciliation_status: "",
          guide_paid_actual: "",
          fees_paid_actual: "",
          expense_reconciled_flag: "",
          invoice_no_txt: "",
          tour_key: "",
          agent_id: checkoutAgentId,
          inquiry_id: inquiryId,
          guest_id: checkoutGuestId,
          booking_id: String(md.booking_id || ""),
          quote_id: String(md.quote_id || ""),
          payment_purpose: String(md.payment_purpose || ""),
          deposit_status: isDeposit && session.payment_status === "paid" ? "available" : "",
          applied_invoice_id: "",
          applied_invoice_no: "",
          applied_at: "",
          stripe_customer_id: typeof session.customer === "string" ? session.customer : (session.customer && session.customer.id || ""),
          currency: String(session.currency || "").toUpperCase(),
          gross_payment_amount: amountTotalCents != null ? centsToDollarsString(amountTotalCents) : "",
        };

        await (async () => {
          try {
            const enriched = await enrichChargeAndFees(env, isTest, session.payment_intent || "");
            fields.stripe_charge_id = enriched.stripe_charge_id || "";
            fields.stripe_receipt_url = enriched.stripe_receipt_url || "";
            fields.transaction_fee_total = enriched.transaction_fee_total || "";

            if (!checkoutAgentId && session.payment_intent) {
              try {
                const pi = await stripeRequest(env, isTest, "GET", `/v1/payment_intents/${encodeURIComponent(session.payment_intent)}`, null);
                checkoutAgentId = pi && pi.metadata && pi.metadata.agent_id ? String(pi.metadata.agent_id) : "";
                fields.agent_id = checkoutAgentId;
              } catch (piErr) {
                console.log("Failed to resolve checkout agent_id from PaymentIntent metadata", {
                  payment_intent_id: session.payment_intent || "",
                  error: String(piErr && piErr.message ? piErr.message : piErr),
                });
              }
            }

            if (inquiryId && !checkoutGuestId) {
              const crmRecord = await lookupCrmInquiry(env, inquiryId);
              checkoutGuestId = crmRecord && crmRecord.guest_id ? String(crmRecord.guest_id) : "";
              fields.guest_id = checkoutGuestId;
            }

            if (session.payment_intent) {
              const piMetadata = new URLSearchParams();
              if (inquiryId) piMetadata.set("metadata[inquiry_id]", inquiryId);
              if (checkoutGuestId) piMetadata.set("metadata[guest_id]", checkoutGuestId);
              if (md.booking_id) piMetadata.set("metadata[booking_id]", String(md.booking_id));
              if (md.quote_id) piMetadata.set("metadata[quote_id]", String(md.quote_id));
              if (md.payment_purpose) piMetadata.set("metadata[payment_purpose]", String(md.payment_purpose));
              if (md.deposit_type) piMetadata.set("metadata[deposit_type]", String(md.deposit_type));
              if (md.deposit_amount) piMetadata.set("metadata[deposit_amount]", String(md.deposit_amount));
              if (md.source_system) piMetadata.set("metadata[source_system]", String(md.source_system));
              if (isDeposit && session.payment_status === "paid") piMetadata.set("metadata[deposit_status]", "available");
              if ([...piMetadata.keys()].length) {
                await stripeRequest(env, isTest, "POST", `/v1/payment_intents/${encodeURIComponent(session.payment_intent)}`, piMetadata);
              }
            }

            await postToSheetsLogger(env, { fields });

            try {
              const bookingPayload = {
                booking_status: "confirmed",
                payment_source: "stripe_checkout",
                stripe_event_id: event.id || "",
                stripe_session_id: session.id || "",
                payment_intent_id: session.payment_intent || "",
                stripe_receipt_url: enriched.stripe_receipt_url || "",
                product_selected: md.tour_code ? String(md.tour_code) : "",
                tour_title: md.tour_title || "",
                tour_date: md.tour_date || "",
                number_of_people: md.number_of_people ? String(md.number_of_people) : "",
                guest_first_name: nameParts.first,
                guest_last_name: nameParts.last,
                guest_email: guestEmail,
                guest_phone: guestPhone,
                whatsapp_number: md.whatsapp_number || "",
                pickup_location_label: md.pickup_location_label || "",
                pickup_address_or_hotel: md.pickup_address_or_hotel || "",
                pickup_time_local: md.pickup_time_local || "",
                pickup_window_minutes: md.pickup_window_minutes || "",
                language: md.language || "en",
                notes: md.notes || "",
                agent_id: checkoutAgentId,
                payment_amount: amountTotalCents != null ? centsToDollarsString(amountTotalCents) : "",
                currency: session.currency ? String(session.currency).toUpperCase() : "USD",
              };
              const bookingConfirmationResult = await postToBookingConfirmationLogger(env, bookingPayload);
              console.log("Booking confirmation logged: stripe_checkout", JSON.stringify(bookingConfirmationResult));
            } catch (bookingErr) {
              console.log("Booking confirmation logging failed: stripe_checkout", {
                error: String(bookingErr && bookingErr.message ? bookingErr.message : bookingErr),
              });
            }
          } catch (err) {
            try {
              await postToSheetsLogger(env, { fields });
              console.log("Checkout Sheets logging recovered with fallback write", {
                stripe_event_id: event.id || "",
                original_error: String(err && err.message ? err.message : err),
              });
            } catch (fallbackErr) {
              console.log("Checkout Sheets logging failed", {
                stripe_event_id: event.id || "",
                original_error: String(err && err.message ? err.message : err),
                fallback_error: String(fallbackErr && fallbackErr.message ? fallbackErr.message : fallbackErr),
              });
              throw fallbackErr;
            }
          }
        })();
      }

      if (["invoice_payment.paid", "invoice.paid", "invoice.payment_succeeded"].includes(event.type)) {
        const isTest = !event.livemode;
        let invoiceId = "";
        const eventObj = event.data && event.data.object ? event.data.object : null;

        if (eventObj) {
          if (eventObj.object === "invoice") invoiceId = eventObj.id || "";
          if (eventObj.object === "invoice_payment") {
            invoiceId = typeof eventObj.invoice === "string"
              ? eventObj.invoice
              : eventObj.invoice && eventObj.invoice.id
                ? eventObj.invoice.id
                : "";
          }
        }

        if (!invoiceId) {
          console.log("Paid invoice event is missing an invoice ID", {
            stripe_event_id: event.id || "",
            event_type: event.type || "",
          });
          return text("Paid invoice event is missing an invoice ID", 400);
        }

        if (invoiceId) {
          await (async () => {
            try {
              const inv = await stripeRequest(
                env,
                isTest,
                "GET",
                `/v1/invoices/${encodeURIComponent(invoiceId)}?expand[]=customer&expand[]=payments&expand[]=payments.data.payment.payment_intent&expand[]=lines.data.price`,
                null
              );

              const invMd = inv.metadata || {};
              if (String(inv.status || "").toLowerCase() !== "paid") {
                console.log("Skipping invoice payment event until invoice is fully paid", {
                  invoice_id: invoiceId,
                  invoice_status: inv.status || "",
                });
                return;
              }
              const paidAtSec = inv.status_transitions && inv.status_transitions.paid_at ? Number(inv.status_transitions.paid_at) : event.created ? Number(event.created) : Math.floor(Date.now() / 1000);
              const paidAt = new Date(paidAtSec * 1000);
              const customerObj = inv.customer && typeof inv.customer === "object" ? inv.customer : null;
              const customerName = inv.customer_name || (customerObj && customerObj.name ? customerObj.name : "") || invMd.main_contact_name || "";
              const nameParts = splitName(customerName);
              const guestEmail = inv.customer_email || (customerObj && customerObj.email ? customerObj.email : "") || invMd.main_contact_email || "";
              const guestPhone = (customerObj && customerObj.phone ? customerObj.phone : "") || invMd.main_contact_phone || "";

              const paymentIntentId = getInvoicePaymentIntentId(inv, eventObj);

              let enriched = {
                stripe_charge_id: "",
                stripe_receipt_url: "",
                transaction_fee_total: "",
                transaction_fee_total_cents: 0,
              };
              if (paymentIntentId) {
                try {
                  enriched = await enrichChargeAndFees(env, isTest, paymentIntentId);
                } catch (err) {
                  console.log("Failed to enrich invoice payment via payment intent", {
                    invoice_id: invoiceId,
                    payment_intent_id: paymentIntentId,
                    error: String(err && err.message ? err.message : err),
                  });
                }
              }

              const lines = inv.lines && Array.isArray(inv.lines.data) ? inv.lines.data : [];
              const serviceLines = lines.filter(isAccountingServiceLine);
              const hasExcludedInvoiceLines = serviceLines.length !== lines.length;
              const isMultiItem = String(invMd.booking_mode || "") === "multi_item" && serviceLines.length > 1;
              const shouldLogPerService = serviceLines.length > 0 && (isMultiItem || hasExcludedInvoiceLines);
              const depositAppliedCents = parseAmountDisplayToCents(invMd.deposit_applied_amount || "");
              const serviceTotalCents = serviceLines.length
                ? serviceLines.reduce((sum, line) => sum + Number(line.amount || 0), 0)
                : Number(inv.amount_paid || 0) + depositAppliedCents;
              const invoiceCustomerId = typeof inv.customer === "string"
                ? inv.customer
                : customerObj && customerObj.id
                  ? customerObj.id
                  : String(invMd.stripe_customer_id || "");
              const primaryServiceIndex = Math.max(
                0,
                serviceLines.findIndex((line) => String((line.metadata || {}).item_index || "") === "1"),
              );

              let accountingFeeCents = Number(enriched.transaction_fee_total_cents || 0);
              const depositPaymentIntentId = String(invMd.deposit_payment_intent_id || "").trim();
              if (depositPaymentIntentId && depositPaymentIntentId !== paymentIntentId) {
                try {
                  const depositEnriched = await enrichChargeAndFees(env, isTest, depositPaymentIntentId);
                  accountingFeeCents += Number(depositEnriched.transaction_fee_total_cents || 0);
                } catch (depositFeeErr) {
                  console.log("Failed to enrich applied deposit fee", {
                    invoice_id: invoiceId,
                    deposit_payment_intent_id: depositPaymentIntentId,
                    error: String(depositFeeErr && depositFeeErr.message ? depositFeeErr.message : depositFeeErr),
                  });
                }
              }

              if (shouldLogPerService) {
                const lineAmountsCents = serviceLines.map((line) => Number(line.amount || 0));
                const feeSplitsCents = splitFeeProportionally(accountingFeeCents, lineAmountsCents);

                for (let i = 0; i < serviceLines.length; i++) {
                  const line = serviceLines[i] || {};
                  const lineMd = line.metadata || {};
                  const linePriceId = lineMd.price_id || (line.price && line.price.id ? line.price.id : line.pricing && line.pricing.price_details && line.pricing.price_details.price ? line.pricing.price_details.price : "");
                  const lineProductId = lineMd.product_id || (line.price && line.price.product ? line.price.product : line.pricing && line.pricing.price_details && line.pricing.price_details.product ? line.pricing.price_details.product : "");
                  const lineQty = lineMd.number_of_people || (line.quantity != null ? String(line.quantity) : "");
                  const lineAmountCents = Number(line.amount || 0);
                  const feeCents = feeSplitsCents[i] || 0;
                  const itemIndex = lineMd.item_index || String(i + 1);

                  const fields = {
                    created_at_iso: formatISOInNY(paidAt),
                    stripe_environment: lineMd.stripe_environment || invMd.stripe_environment || (event.livemode ? "live" : "sandbox"),
                    stripe_event_id: event.id || "",
                    stripe_session_id: "",
                    stripe_payment_intent: paymentIntentId,
                    stripe_charge_id: enriched.stripe_charge_id || "",
                    stripe_product_id: lineProductId || "",
                    stripe_price_id: linePriceId || "",
                    stripe_payment_link_id: "",
                    stripe_receipt_url: enriched.stripe_receipt_url || "",
                    invoice_no: inv.number || "",
                    date_paid: formatDateNY(paidAt),
                    tour_date: lineMd.tour_date || "",
                    tour_completed: "",
                    guest_first_name: nameParts.first,
                    guest_last_name: nameParts.last,
                    guest_email: guestEmail,
                    guest_phone: guestPhone,
                    home_country: customerObj && customerObj.address && customerObj.address.country ? String(customerObj.address.country) : "",
                    party_size: lineQty,
                    service_type: lineMd.service_type || "",
                    tour_title: lineMd.tour_title || "",
                    tour_guide: "",
                    payment_method: "Stripe",
                    invoice_id: inv.id || "",
                    transaction_id: paymentIntentId,
                    product_selected: lineMd.tour_code ? String(lineMd.tour_code) : "",
                    guest_rate_override: lineMd.price_override_per_person || "",
                    standard_price_per_person: lineMd.standard_price_per_person || "",
                    price_adjustment_per_person: lineMd.price_adjustment_per_person || "",
                    final_price_per_person: lineMd.final_price_per_person || lineMd.price_override_per_person || lineMd.standard_price_per_person || "",
                    pricing_reason: lineMd.pricing_reason || "",
                    pricing_notes: lineMd.pricing_notes || "",
                    discount_rate_guest: "",
                    discount_reason: "",
                    amount_received: centsToDollarsString(lineAmountCents),
                    transaction_fee_total: centsToDollarsString(feeCents),
                    fee_pct_of_amount_received: "",
                    mbw_fee_pct_override: "",
                    total_tip_collected: "",
                    tip_paid_to_guide_override: "",
                    pickup_location: lineMd.pickup_location_label || invMd.pickup_location_label || "",
                    pickup_address_or_hotel: lineMd.pickup_address_or_hotel || invMd.pickup_address_or_hotel || "",
                    other_guests: "",
                    notes: lineMd.item_notes || lineMd.notes || invMd.notes || "",
                    month_ky: "",
                    guest_rate_per_person: "",
                    subtotal_guest: centsToDollarsString(lineAmountCents),
                    discount_amount: "",
                    final_invoice_total: centsToDollarsString(lineAmountCents),
                    expected_total_with_tip: "",
                    variance_received_minus_expected: "",
                    fee_mode: "",
                    default_mbw_fee_pct: "",
                    mbw_fee_pct_used: "",
                    fees_charged_to_mbw: "",
                    fees_charged_to_guide: "",
                    guide_pay_model: "",
                    guide_base_rate: "",
                    guide_base_payout: "",
                    guide_tip_pct_used: "",
                    tip_paid_to_guide: "",
                    tip_paid_to_mbw: "",
                    total_amount_owed_to_guide: "",
                    mbw_gross_expected: "",
                    mbw_gross_actual: "",
                    gross_discrepency: "",
                    mbw_profit_expected: "",
                    mbw_profit_accrual: "",
                    net_discrepency: "",
                    mbw_profit_margin: "",
                    mbw_cash_expected: "",
                    mbw_cash_actual: "",
                    cash_discrepency: "",
                    mbw_cash_profit_margin: "",
                    reconciliation_status: "",
                    guide_paid_actual: "",
                    fees_paid_actual: "",
                    expense_reconciled_flag: "",
                    invoice_no_txt: inv.number || "",
                    tour_key: buildTourKey(inv.id || "", itemIndex, lineMd.tour_code || "", lineMd.tour_date || "", lineQty),
                    agent_id: lineMd.agent_id || invMd.agent_id || "",
                    inquiry_id: lineMd.inquiry_id || invMd.inquiry_id || "",
                    guest_id: lineMd.guest_id || invMd.guest_id || "",
                    booking_id: lineMd.booking_id || invMd.booking_id || "",
                    deposit_applied_amount: i === primaryServiceIndex && depositAppliedCents ? centsToDollarsString(depositAppliedCents) : "",
                    deposit_payment_intent_id: depositPaymentIntentId,
                    deposit_payment_method: depositPaymentIntentId ? String(invMd.deposit_payment_method || "Stripe") : "",
                    stripe_customer_id: invoiceCustomerId,
                    amount_before_deposit: i === primaryServiceIndex ? centsToDollarsString(serviceTotalCents) : "",
                    amount_remaining: i === primaryServiceIndex ? centsToDollarsString(Number(inv.amount_remaining || 0)) : "",
                    quote_id: lineMd.quote_id || invMd.quote_id || "",
                  };

                  const sheetsResult = await postToSheetsLogger(env, { fields });
                  if (sheetsResult && sheetsResult.skipped_duplicate === true) {
                    console.log("Duplicate invoice service row already logged; confirmation skipped", {
                      invoice_id: inv.id || "",
                      item_index: itemIndex,
                      event_type: event.type || "",
                    });
                    continue;
                  }

                  try {
                    const bookingPayload = {
                      booking_status: "confirmed",
                      payment_source: "stripe_invoice",
                      stripe_event_id: event.id || "",
                      stripe_session_id: "",
                      payment_intent_id: paymentIntentId,
                      stripe_receipt_url: enriched.stripe_receipt_url || "",
                      product_selected: lineMd.tour_code ? String(lineMd.tour_code) : "",
                      tour_title: lineMd.tour_title || "",
                      tour_date: lineMd.tour_date || "",
                      number_of_people: lineQty,
                      guest_first_name: nameParts.first,
                      guest_last_name: nameParts.last,
                      guest_email: guestEmail,
                      guest_phone: guestPhone,
                      whatsapp_number: lineMd.whatsapp_number || invMd.whatsapp_number || "",
                      pickup_location_label: lineMd.pickup_location_label || invMd.pickup_location_label || "",
                      pickup_address_or_hotel: lineMd.pickup_address_or_hotel || invMd.pickup_address_or_hotel || "",
                      pickup_time_local: lineMd.pickup_time_local || "",
                      pickup_window_minutes: lineMd.pickup_window_minutes || "",
                      language: lineMd.language || "en",
                      notes: lineMd.item_notes || lineMd.notes || invMd.notes || "",
                      agent_id: lineMd.agent_id || invMd.agent_id || "",
                      payment_amount: centsToDollarsString(lineAmountCents),
                      currency: inv.currency ? String(inv.currency).toUpperCase() : "USD",
                    };
                    const bookingConfirmationResult = await postToBookingConfirmationLogger(env, bookingPayload);
                    console.log("Booking confirmation logged: stripe_invoice multi", JSON.stringify(bookingConfirmationResult));
                  } catch (bookingErr) {
                    console.log("Booking confirmation logging failed: stripe_invoice multi", {
                      invoice_id: inv.id || "",
                      item_index: itemIndex,
                      error: String(bookingErr && bookingErr.message ? bookingErr.message : bookingErr),
                    });
                  }
                }
              } else {
                const md = invMd;
                const amountPaidCents = inv.amount_paid != null ? Number(inv.amount_paid) : null;
                const fields = {
                  created_at_iso: formatISOInNY(paidAt),
                  stripe_environment: md.stripe_environment || (event.livemode ? "live" : "sandbox"),
                  stripe_event_id: event.id || "",
                  stripe_session_id: "",
                  stripe_payment_intent: paymentIntentId,
                  stripe_charge_id: enriched.stripe_charge_id || "",
                  stripe_product_id: md.product_id || "",
                  stripe_price_id: md.price_id || "",
                  stripe_payment_link_id: "",
                  stripe_receipt_url: enriched.stripe_receipt_url || "",
                  invoice_no: inv.number || "",
                  date_paid: formatDateNY(paidAt),
                  tour_date: md.tour_date || "",
                  tour_completed: "",
                  guest_first_name: nameParts.first,
                  guest_last_name: nameParts.last,
                  guest_email: guestEmail,
                  guest_phone: guestPhone,
                  home_country: customerObj && customerObj.address && customerObj.address.country ? String(customerObj.address.country) : "",
                  party_size: md.number_of_people ? String(md.number_of_people) : "",
                  service_type: md.service_type || "",
                  tour_title: md.tour_title || "",
                  tour_guide: "",
                  payment_method: "Stripe",
                  invoice_id: inv.id || "",
                  transaction_id: paymentIntentId,
                  product_selected: md.tour_code ? String(md.tour_code) : "",
                  guest_rate_override: md.price_override_per_person || "",
                  standard_price_per_person: md.standard_price_per_person || "",
                  price_adjustment_per_person: md.price_adjustment_per_person || "",
                  final_price_per_person: md.final_price_per_person || md.price_override_per_person || md.standard_price_per_person || "",
                  pricing_reason: md.pricing_reason || "",
                  pricing_notes: md.pricing_notes || "",
                  discount_rate_guest: "",
                  discount_reason: "",
                  amount_received: amountPaidCents != null ? centsToDollarsString(amountPaidCents) : "",
                  transaction_fee_total: centsToDollarsString(accountingFeeCents),
                  fee_pct_of_amount_received: "",
                  mbw_fee_pct_override: "",
                  total_tip_collected: "",
                  tip_paid_to_guide_override: "",
                  pickup_location: md.pickup_location_label || "",
                  pickup_address_or_hotel: md.pickup_address_or_hotel || "",
                  other_guests: "",
                  notes: [md.notes || "", md.pricing_notes ? `Pricing notes: ${md.pricing_notes}` : ""].filter(Boolean).join("\n"),
                  month_ky: "",
                  guest_rate_per_person: md.final_price_per_person || md.price_override_per_person || md.standard_price_per_person || "",
                  subtotal_guest: amountPaidCents != null ? centsToDollarsString(amountPaidCents) : "",
                  discount_amount: "",
                  final_invoice_total: amountPaidCents != null ? centsToDollarsString(amountPaidCents) : "",
                  expected_total_with_tip: "",
                  variance_received_minus_expected: "",
                  fee_mode: "",
                  default_mbw_fee_pct: "",
                  mbw_fee_pct_used: "",
                  fees_charged_to_mbw: "",
                  fees_charged_to_guide: "",
                  guide_pay_model: "",
                  guide_base_rate: "",
                  guide_base_payout: "",
                  guide_tip_pct_used: "",
                  tip_paid_to_guide: "",
                  tip_paid_to_mbw: "",
                  total_amount_owed_to_guide: "",
                  mbw_gross_expected: "",
                  mbw_gross_actual: "",
                  gross_discrepency: "",
                  mbw_profit_expected: "",
                  mbw_profit_accrual: "",
                  net_discrepency: "",
                  mbw_profit_margin: "",
                  mbw_cash_expected: "",
                  mbw_cash_actual: "",
                  cash_discrepency: "",
                  mbw_cash_profit_margin: "",
                  reconciliation_status: "",
                  guide_paid_actual: "",
                  fees_paid_actual: "",
                  expense_reconciled_flag: "",
                  invoice_no_txt: inv.number || "",
                  tour_key: buildTourKey(inv.id || "", "1", md.tour_code || "", md.tour_date || "", md.number_of_people || ""),
                  agent_id: md.agent_id || "",
                  inquiry_id: md.inquiry_id || "",
                  guest_id: md.guest_id || "",
                  booking_id: md.booking_id || "",
                  deposit_applied_amount: depositAppliedCents ? centsToDollarsString(depositAppliedCents) : "",
                  deposit_payment_intent_id: depositPaymentIntentId,
                  deposit_payment_method: depositPaymentIntentId ? String(md.deposit_payment_method || "Stripe") : "",
                  stripe_customer_id: invoiceCustomerId,
                  amount_before_deposit: centsToDollarsString(serviceTotalCents),
                  amount_remaining: centsToDollarsString(Number(inv.amount_remaining || 0)),
                  quote_id: md.quote_id || "",
                };
                const sheetsResult = await postToSheetsLogger(env, { fields });

                if (sheetsResult && sheetsResult.skipped_duplicate === true) {
                  console.log("Duplicate invoice row already logged; confirmation skipped", {
                    invoice_id: inv.id || "",
                    event_type: event.type || "",
                  });
                } else {
                  try {
                    const bookingPayload = {
                    booking_status: "confirmed",
                    payment_source: "stripe_invoice",
                    stripe_event_id: event.id || "",
                    stripe_session_id: "",
                    payment_intent_id: paymentIntentId,
                    stripe_receipt_url: enriched.stripe_receipt_url || "",
                    product_selected: md.tour_code ? String(md.tour_code) : "",
                    tour_title: md.tour_title || "",
                    tour_date: md.tour_date || "",
                    number_of_people: md.number_of_people ? String(md.number_of_people) : "",
                    guest_first_name: nameParts.first,
                    guest_last_name: nameParts.last,
                    guest_email: guestEmail,
                    guest_phone: guestPhone,
                    whatsapp_number: md.whatsapp_number || "",
                    pickup_location_label: md.pickup_location_label || "",
                    pickup_address_or_hotel: md.pickup_address_or_hotel || "",
                    pickup_time_local: md.pickup_time_local || "",
                    pickup_window_minutes: md.pickup_window_minutes || "",
                    language: md.language || "en",
                    notes: [md.notes || "", md.pricing_notes ? `Pricing notes: ${md.pricing_notes}` : ""].filter(Boolean).join("\n"),
                    agent_id: md.agent_id || "",
                    standard_price_per_person: md.standard_price_per_person || "",
                    price_adjustment_per_person: md.price_adjustment_per_person || "",
                    final_price_per_person: md.final_price_per_person || md.price_override_per_person || md.standard_price_per_person || "",
                    price_override_per_person: md.price_override_per_person || "",
                    pricing_reason: md.pricing_reason || "",
                    pricing_notes: md.pricing_notes || "",
                    payment_amount: amountPaidCents != null ? centsToDollarsString(amountPaidCents) : "",
                    currency: inv.currency ? String(inv.currency).toUpperCase() : "USD",
                    };
                    const bookingConfirmationResult = await postToBookingConfirmationLogger(env, bookingPayload);
                    console.log("Booking confirmation logged: stripe_invoice single", JSON.stringify(bookingConfirmationResult));
                  } catch (bookingErr) {
                    console.log("Booking confirmation logging failed: stripe_invoice single", {
                      invoice_id: inv.id || "",
                      error: String(bookingErr && bookingErr.message ? bookingErr.message : bookingErr),
                    });
                  }
                }
              }
              const firstServiceMetadata = serviceLines.length ? (serviceLines[0].metadata || {}) : invMd;
              await syncCrmInvoiceLedger(env, {
                inquiry_id: firstServiceMetadata.inquiry_id || invMd.inquiry_id || "",
                guest_id: firstServiceMetadata.guest_id || invMd.guest_id || "",
                booking_id: firstServiceMetadata.booking_id || invMd.booking_id || "",
                invoice_id: inv.id || "",
                invoice_no: inv.number || "",
                transaction_id: paymentIntentId,
                total_booking_price: serviceTotalCents / 100,
                deposit_amount_paid: depositAppliedCents / 100,
                additional_amount_paid: Number(inv.amount_paid || 0) / 100,
                total_amount_paid: (Number(inv.amount_paid || 0) + depositAppliedCents) / 100,
                balance_remaining: Number(inv.amount_remaining || 0) / 100,
                payment_date: formatDateNY(paidAt),
                tour_date_start: firstServiceMetadata.tour_date || "",
                tour_date_end: serviceLines.length ? (serviceLines.map(line => String((line.metadata || {}).tour_date || "")).filter(Boolean).sort().slice(-1)[0] || firstServiceMetadata.tour_date || "") : firstServiceMetadata.tour_date || "",
                party_size: firstServiceMetadata.number_of_people || "",
                service_type: serviceLines.length > 1 ? "Multi Item" : firstServiceMetadata.service_type || "",
                product_selected: serviceLines.map(line => String((line.metadata || {}).tour_code || "")).filter(Boolean).join(" | ") || firstServiceMetadata.tour_code || "",
                pickup_location: firstServiceMetadata.pickup_location_label || invMd.pickup_location_label || "",
                currency: inv.currency ? String(inv.currency).toUpperCase() : "USD",
                notes: "Stripe invoice paid and synchronized from webhook.",
              });
            } catch (err) {
              console.log("Invoice sheets logging failed", {
                stripe_event_id: event.id || "",
                event_type: event.type || "",
                invoice_id: invoiceId,
                error: String(err && err.message ? err.message : err),
              });
              throw err;
            }
          })();
        }
      }

      return text("ok", 200);
    }

    return text("Not found", 404);
  },
};

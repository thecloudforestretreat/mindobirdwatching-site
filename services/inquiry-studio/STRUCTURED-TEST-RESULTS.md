# Structured drafting test results

Six fresh local-model generations; three real inquiries and three synthetic cases. No saved customer drafts or live systems changed.

| Case | Seconds | Selection |
|---|---:|---|
| Andrew | 15.2 | tour-full-day, tour-andean, tour-jewels, transport-quito |
| Kathy | 7.0 | tour-full-day, tour-andean, tour-jewels, transport-quito |
| Raegan | 6.6 | tour-full-day |
| Spanish | 7.3 | tour-full-day, tour-andean, tour-jewels, transport-quito |
| Morning only | 5.0 | tour-andean, tour-jewels, transport-quito |
| Specific tour | 6.0 | tour-jewels |

All six preserved the intended tour selection and transport facts. Human review still applies: the model sometimes uses stiff language such as “aligns perfectly,” and the Spanish paragraph mixes formal and informal address. This is not a claim of 10/10 reliability.

31 automated tests pass, including early-return filtering, missing information, specialty-review routing, and rejection of AI transport/price text. Editor pricing review/export checks pass.

The core transport and tour copy now comes from structured facts and business rules. The local model supplies only a short interest paragraph. If that paragraph fails checks or the model is unavailable, the app labels the template fallback in private review notes.

Limits: extraction supports common English/Spanish wording, not arbitrary itineraries. Supplemental corrections and nonstandard requests require review. Current catalog prices remain unapproved defaults. Actual transport feasibility is never inferred.

## Andrew

Thank you for reaching out. We recommend the full-day Quest tour, our most complete option for exploring the cloud forest birds. Other options are the half-day Andean Cock-of-the-Rock tour or the Jewels of the Morning Forest tour. Your interest in seeing Tanagers aligns perfectly with the colorful forest birds highlighted in your selected tours. We can coordinate pickup at Tababela. Our transportation rates are based out of Quito. Tababela is on the outskirts of Quito. We can coordinate dropping you off in Mindo.

Next steps: Please share your exact pickup location so we can confirm transportation. Please share your drop-off location in Mindo. Let us know which tour you prefer.

## Kathy

Thank you for reaching out. We recommend the full-day Quest tour, our most complete option for exploring the cloud forest birds. Other options are the half-day Andean Cock-of-the-Rock tour or the Jewels of the Morning Forest tour. These tours offer early morning opportunities to explore vibrant cloud forests while seeking Andean Cock-of-the-Rock, toucans, tanagers, and hummingbirds. We can coordinate pickup at Hilton Colon Quito. Our transportation rates are based out of Quito. We’ll plan around your requested return to Quito by 5pm.

Next steps: Let us know which tour you prefer.

## Raegan

Thank you for reaching out. We recommend the full-day Quest tour, our most complete option for exploring the cloud forest birds. This tour offers a dawn Cock-of-the-Rock observation followed by extended forest birding to maximize your new sightings of toucans, tanagers, and hummingbirds.

Next steps: No additional facts requested.

## Spanish

Gracias por escribirnos. Te recomendamos el tour Quest de día completo, nuestra opción más completa para explorar las aves del bosque nublado. También puedes elegir el tour de medio día del gallito de la peña o el tour Jewels of the Morning Forest. Estos tours ofrecen la oportunidad de observar tucanes y otros pájaros coloridos en el bosque nuboso, alineándose con su interés en avistamiento de aves. Podemos coordinar la recogida en Hotel Quito. Nuestras tarifas de transporte se basan en salidas desde Quito. Organizaremos la propuesta teniendo en cuenta tu regreso a Quito antes de las 5pm.

Next steps: Cuéntanos qué opción prefieres.

## Morning only

Thank you for reaching out. We recommend the half-day Andean Cock-of-the-Rock tour. Other options are the Jewels of the Morning Forest tour. Both selected morning tours offer wonderful opportunities to spot hummingbirds alongside other vibrant forest birds in the cloud forest. We can coordinate pickup at Quito. Our transportation rates are based out of Quito.

Next steps: Please share your exact pickup location so we can confirm transportation. Let us know which tour you prefer.

## Specific tour

Thank you for reaching out. We recommend the Jewels of the Morning Forest tour. The Jewels of the Morning Forest tour aligns perfectly with your interest in tanagers by focusing on these colorful forest birds alongside other vibrant species.

Next steps: No additional facts requested.

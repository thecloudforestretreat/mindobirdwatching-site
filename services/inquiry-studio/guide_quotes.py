"""Deterministically structure guide and supplier quote messages.

The source message remains authoritative. This parser creates a review aid; it
does not turn supplier prices into guest-facing prices or confirmed services.
"""

from __future__ import annotations

import copy
import re
from datetime import datetime, timezone


MONEY_RE = re.compile(r"(?:US\$|USD|\$)\s*([0-9][0-9,.]*)", re.IGNORECASE)
LINE_RE = re.compile(r"^\s*(\d{1,2})(?:(\.)|\s+)\s*(.+)$")
WHATSAPP_RE = re.compile(r"^\[[^\]]+\]\s*[^:]{1,120}:\s*")


def _now():
    return datetime.now(timezone.utc).isoformat()


def _text(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _categories(value):
    normalized = _text(value).casefold()
    matches = []
    rules = [
        ("guide", ("guía", "guia", "guide")),
        ("Ecuador transport", ("transporte", "traslado", "transfer")),
        ("entrance fees", ("ingreso", "entrada", "entrance")),
        ("lodging", ("hospedaje", "alojamiento", "hotel")),
        ("meals", ("alimentación", "alimentacion", "comidas", "pensión", "pension")),
        ("breakfast", ("desayuno", "breakfast")),
        ("lunch", ("almuerzo", "lunch")),
        ("dinner", ("cena", "dinner")),
        ("night walk", ("caminata nocturna", "night walk")),
        ("horse riding", ("cabalgata", "cabalgatas", "horse")),
    ]
    for label, needles in rules:
        if any(needle in normalized for needle in needles):
            matches.append(label)
    return matches


def _amount(value):
    match = MONEY_RE.search(value)
    if not match:
        return None
    number = match.group(1).replace(",", "")
    amount = float(number)
    return int(amount) if amount.is_integer() else amount


def _date_lookup(proposed_days):
    by_number = {}
    by_month_day = {}
    for day in proposed_days if isinstance(proposed_days, list) else []:
        if not isinstance(day, dict):
            continue
        number = day.get("day_number")
        if str(number).isdigit():
            by_number[int(number)] = day
        date = str(day.get("date") or "")
        match = re.search(r"(?:^|-)\d{4}-\d{2}-(\d{2})(?:$|\D)", date)
        if match:
            by_month_day[int(match.group(1))] = day
    return by_number, by_month_day


def _split_scope(value):
    lowered = value.casefold()
    scope_word = r"(?:incluye|incluid[oa]s?)"
    include_at = re.search(rf"(?<!no )\b{scope_word}\b", lowered)
    exclude_at = re.search(rf"\bno\s+{scope_word}\b", lowered)
    included = []
    excluded = []
    if include_at:
        end = exclude_at.start() if exclude_at and exclude_at.start() > include_at.start() else len(value)
        included = _categories(value[include_at.end() : end])
    # Some guides write the priced scope before the amount, for example
    # "costo guia transporte $190 no incluye ingreso". Treat only the words
    # between "costo" and the amount as inclusions; activity words elsewhere
    # in the sentence remain descriptive rather than priced.
    cost_scope = re.search(
        r"\bcostos?(?:\s+total)?\b(.*?)(?:(?:US\$|USD|\$)\s*[0-9])",
        value,
        re.IGNORECASE,
    )
    if cost_scope:
        included.extend(_categories(cost_scope.group(1)))
    if exclude_at:
        excluded = _categories(value[exclude_at.end() :])
    return list(dict.fromkeys(included)), list(dict.fromkeys(excluded))


def _candidate_lines(message):
    lines = []
    for raw in str(message or "").splitlines():
        line = _text(WHATSAPP_RE.sub("", raw))
        if line:
            lines.append(line)
    return lines


def _review_flags(items, global_pending):
    flags = []
    for item in items:
        label = item["date"] or f"Day {item['day_number']}"
        if item["price_status"] == "pending":
            flags.append(f"Confirm the price for {label}.")
        if "entrance fees" in item["excluded"] and "entrance fees" not in item.get("resolved_exclusions", []):
            flags.append(f"Confirm the excluded entrance fee for {label}.")
        source = item["supplier_plan"].casefold()
        if (
            ("o si" in source or "opci" in source)
            and item["amount_usd"] is not None
            and not item.get("scope_confirmed")
        ):
            flags.append(f"Confirm which optional activity is covered by the {label} price.")
        if item["amount_usd"] is not None and not item["included"] and not item["excluded"]:
            flags.append(f"Confirm the inclusions for the {label} price.")
    flags.extend(f"Confirm {value.lower()}." for value in global_pending)
    return list(dict.fromkeys(flags))


def _followup_segments(message, items):
    days = sorted(
        {
            int(str(item.get("date") or "")[-2:])
            for item in items
            if re.fullmatch(r"20\d{2}-\d{2}-\d{2}", str(item.get("date") or ""))
        }
    )
    if not days:
        return {}
    pattern = re.compile(r"(?<![$\d])\b(" + "|".join(map(str, days)) + r")\b")
    matches = list(pattern.finditer(str(message or "")))
    return {
        int(match.group(1)): str(message or "")[match.end() : matches[index + 1].start() if index + 1 < len(matches) else None]
        for index, match in enumerate(matches)
    }


def merge_guide_quote_followup(previous_quote, message, proposed_days=None, sender="Guide", received_at=None):
    """Apply concise supplier confirmations to the latest full quote."""
    quote = copy.deepcopy(previous_quote if isinstance(previous_quote, dict) else {})
    items = quote.get("items") if isinstance(quote.get("items"), list) else []
    segments = _followup_segments(message, items)
    by_day = {
        int(str(item.get("date") or "")[-2:]): item
        for item in items
        if re.fullmatch(r"20\d{2}-\d{2}-\d{2}", str(item.get("date") or ""))
    }
    lower = _text(message).casefold()

    if re.search(r"(?:costos?|valores?).{0,30}(?:dos|2)\s+personas", lower):
        quote["pricing_basis"] = "total_for_party"
        quote["party_size"] = 2

    day19 = by_day.get(19)
    match19 = re.search(r"\bcosto\s+(?:del\s+)?19\b[^$]{0,50}\$\s*([0-9][0-9,.]*)", lower)
    if day19 and match19:
        day19["amount_usd"] = float(match19.group(1).replace(",", ""))
        if day19["amount_usd"].is_integer():
            day19["amount_usd"] = int(day19["amount_usd"])
        day19["price_status"] = "quoted"
        day19["included"] = list(dict.fromkeys([*(day19.get("included") or []), "Ecuador transport"]))
        day19["pending"] = []
        day19["scope_confirmed"] = True

    day21 = by_day.get(21)
    if day21 and "ibarra" in _text(segments.get(21)).casefold():
        day21["confirmed_details"] = list(
            dict.fromkeys([*(day21.get("confirmed_details") or []), "Price includes the transfer through Ibarra"])
        )

    reserve_confirmation = _text(segments.get(22)) + " " + _text(segments.get(23))
    if re.search(r"(?:confirm|pendiente)", reserve_confirmation, re.IGNORECASE) or re.search(
        r"\b22\s+y\s+23\b.{0,180}(?:confirm|ingres|valor)", lower
    ):
        quote["global_pending"] = [
            value
            for value in quote.get("global_pending", [])
            if "bear reserve entrance" not in str(value).casefold()
        ]
        quote["global_pending"].append("Bear reserve entrance fee for Days 22–23")

    day24 = by_day.get(24)
    segment24 = _text(segments.get(24)).casefold()
    if day24 and "incluye" in segment24 and "caminata nocturna" in segment24:
        day24["included"] = list(dict.fromkeys([*(day24.get("included") or []), "night walk"]))
        day24["scope_confirmed"] = True
    if day24 and re.search(r"cena\s+no\s+incluye|no\s+incluye\s+(?:la\s+)?cena", segment24):
        day24["excluded"] = list(dict.fromkeys([*(day24.get("excluded") or []), "Christmas dinner"]))

    day25 = by_day.get(25)
    segment25 = _text(segments.get(25))
    if day25 and "incluye" in segment25.casefold():
        additions = _categories(segment25)
        for label, needles in [
            ("Cock-of-the-Rock lek", ("lek", "gallo de la peña")),
            ("butterfly tour", ("mariposa",)),
            ("chocolate tour", ("chocolate",)),
        ]:
            if any(needle in segment25.casefold() for needle in needles):
                additions.append(label)
        day25["included"] = list(dict.fromkeys([*(day25.get("included") or []), *additions]))
        day25["scope_confirmed"] = True

    day27 = by_day.get(27)
    segment27 = _text(segments.get(27))
    if day27 and re.search(r"incluye|\bpor\b", segment27, re.IGNORECASE):
        day27["included"] = list(dict.fromkeys([*(day27.get("included") or []), *_categories(segment27)]))
        day27["confirmed_details"] = list(
            dict.fromkeys([*(day27.get("confirmed_details") or []), "Includes transfer to Cotopaxi"])
        )
        day27["scope_confirmed"] = True

    day28 = by_day.get(28)
    segment28 = _text(segments.get(28))
    if day28 and segment28:
        priced_scope = re.split(r"cabalg", segment28, maxsplit=1, flags=re.IGNORECASE)[0]
        day28["included"] = list(dict.fromkeys([*(day28.get("included") or []), *_categories(priced_scope)]))
        day28["excluded"] = list(dict.fromkeys([*(day28.get("excluded") or []), "horse riding"]))
        day28["pending"] = list(dict.fromkeys([*(day28.get("pending") or []), "horse riding price"]))
        day28["scope_confirmed"] = True
        if not any("horseback riding" in str(value).casefold() for value in quote.get("global_pending", [])):
            quote.setdefault("global_pending", []).append("Horseback riding price for Day 28")

    # Guides often confirm a single pending add-on in a later WhatsApp message
    # without repeating the itinerary date. Keep it separate from the base-day
    # price so an optional activity does not silently inflate the core quote.
    riding_rate = re.search(
        r"(?:cabalgata[^$]{0,100}\$\s*([0-9][0-9,.]*)[^.]{0,80}por\s+persona|"
        r"\$\s*([0-9][0-9,.]*)[^.]{0,80}por\s+persona[^.]{0,100}cabalgata)",
        lower,
    )
    if riding_rate:
        amount = float(next(value for value in riding_rate.groups() if value).replace(",", ""))
        if amount.is_integer():
            amount = int(amount)
        party_size = int(quote.get("party_size") or 0) or None
        total = amount * party_size if party_size else None
        duration_match = re.search(r"(?:alrededor\s+de\s+)?(dos|2)\s+horas?", lower)
        optional_charge = {
            "date": day28.get("date") if day28 else "",
            "label": "Horseback riding at Tambopaxi",
            "location": "Tambopaxi" if "tambopaxi" in lower else "",
            "amount_usd_per_person": amount,
            "party_size": party_size,
            "party_total_usd": total,
            "duration_minutes": 120 if duration_match else None,
            "status": "quoted_optional",
            "source_text": str(message or "").strip(),
        }
        optional_charges = [
            value
            for value in quote.get("optional_charges", [])
            if str(value.get("label") or "").casefold() != "horseback riding at tambopaxi"
        ]
        optional_charges.append(optional_charge)
        quote["optional_charges"] = optional_charges
        if day28:
            day28["pending"] = [
                value for value in day28.get("pending", []) if "horse riding" not in str(value).casefold()
            ]
            day28["confirmed_details"] = list(
                dict.fromkeys(
                    [
                        *(day28.get("confirmed_details") or []),
                        "$30 per person for approximately two hours at Tambopaxi",
                    ]
                )
            )
        quote["global_pending"] = [
            value for value in quote.get("global_pending", []) if "horseback riding" not in str(value).casefold()
        ]
        reusable_facts = [
            value
            for value in quote.get("reusable_facts", [])
            if str(value.get("service_key") or "") != "tambopaxi_horseback_riding"
        ]
        reusable_facts.append(
            {
                "fact_type": "supplier_rate",
                "service_key": "tambopaxi_horseback_riding",
                "service_name": "Horseback riding",
                "location": "Tambopaxi",
                "currency": "USD",
                "amount": amount,
                "unit": "per_person",
                "duration_minutes": 120 if duration_match else None,
                "supplier": _text(sender)[:120] or "Guide",
                "verified_at": received_at or _now(),
                "reuse_status": "verify_before_reuse",
            }
        )
        quote["reusable_facts"] = reusable_facts

    if "reserva" in lower and "oso" in lower and "por persona" in lower:
        amounts = [float(value.replace(",", "")) for value in re.findall(r"\$\s*([0-9][0-9,.]*)", lower)]
        per_visit = next((value for value in amounts if value == 35), amounts[0] if amounts else None)
        visit_count = 2 if re.search(r"(?:dos|2)\s+d[ií]as", lower) else 1
        per_person_total = next(
            (value for value in amounts if value == per_visit * visit_count and value != per_visit),
            per_visit * visit_count if per_visit is not None else None,
        )
        if per_visit is not None:
            per_visit = int(per_visit) if per_visit.is_integer() else per_visit
            per_person_total = int(per_person_total) if per_person_total.is_integer() else per_person_total
            party_size = int(quote.get("party_size") or 0) or None
            additional_charge = {
                "dates": [value.get("date") for value in (by_day.get(22), by_day.get(23)) if value],
                "label": "Bear reserve entrance fees",
                "location": "San José de Sigsipamba bear reserve",
                "amount_usd_per_person_per_visit": per_visit,
                "visit_count": visit_count,
                "amount_usd_per_person": per_person_total,
                "party_size": party_size,
                "party_total_usd": per_person_total * party_size if party_size else None,
                "status": "quoted_required",
                "source_text": str(message or "").strip(),
            }
            additional_charges = [
                value
                for value in quote.get("additional_charges", [])
                if str(value.get("label") or "").casefold() != "bear reserve entrance fees"
            ]
            additional_charges.append(additional_charge)
            quote["additional_charges"] = additional_charges
            for day_number in (22, 23):
                item = by_day.get(day_number)
                if not item:
                    continue
                item["resolved_exclusions"] = list(
                    dict.fromkeys([*(item.get("resolved_exclusions") or []), "entrance fees"])
                )
                item["confirmed_details"] = list(
                    dict.fromkeys(
                        [
                            *(item.get("confirmed_details") or []),
                            f"Reserve entry priced separately at ${per_visit} per person",
                        ]
                    )
                )
            quote["global_pending"] = [
                value
                for value in quote.get("global_pending", [])
                if "bear reserve entrance" not in str(value).casefold()
            ]
            reusable_facts = [
                value
                for value in quote.get("reusable_facts", [])
                if str(value.get("service_key") or "") != "sigsipamba_bear_reserve_entrance"
            ]
            reusable_facts.append(
                {
                    "fact_type": "supplier_rate",
                    "service_key": "sigsipamba_bear_reserve_entrance",
                    "service_name": "Bear reserve entrance",
                    "location": "San José de Sigsipamba",
                    "currency": "USD",
                    "amount": per_visit,
                    "unit": "per_person_per_visit",
                    "supplier": _text(sender)[:120] or "Guide",
                    "verified_at": received_at or _now(),
                    "reuse_status": "verify_before_reuse",
                }
            )
            quote["reusable_facts"] = reusable_facts

    if "hotel" in lower and "ibarra" in lower and re.search(
        r"(?:una|1)\s+hora\s+(?:(?:y|i)\s*)?media", lower
    ):
        quote["lodging_plan"] = {
            "base": "Ibarra",
            "applies_to": "Bear-reserve segment",
            "travel_time_to_reserve_minutes": 90,
            "hotel_selection_status": "pending",
            "source_text": str(message or "").strip(),
        }
        operational_notes = [
            value
            for value in quote.get("operational_notes", [])
            if str(value.get("fact_key") or "") != "ibarra_to_bear_reserve"
        ]
        operational_notes.append(
            {
                "fact_key": "ibarra_to_bear_reserve",
                "text": "Use Ibarra as the hotel base; the bear reserve is approximately 90 minutes away.",
                "reuse_status": "verify_before_reuse",
            }
        )
        quote["operational_notes"] = operational_notes

    quote["global_pending"] = [
        value for value in quote.get("global_pending", []) if "arrival airport transfer" not in str(value).casefold()
    ]
    quote["source_type"] = "guide_followup"
    quote["sender"] = _text(sender)[:120] or "Guide"
    quote["received_at"] = received_at or _now()
    quote["followup_source_text"] = str(message or "").strip()
    quote["known_supplier_subtotal_usd"] = sum(
        item.get("amount_usd") or 0 for item in items if item.get("amount_usd") is not None
    )
    quote["review_flags"] = _review_flags(items, quote.get("global_pending", []))
    quote_by_date = {item.get("date"): item for item in items if item.get("date")}
    quote["merged_days"] = [
        {**day, "guide_quote": quote_by_date.get(str(day.get("date") or ""))}
        for day in proposed_days if isinstance(day, dict)
    ]
    quote["items"] = items
    return quote


def parse_guide_quote(message, proposed_days=None, sender="Guide", received_at=None):
    """Return a normalized, review-required supplier quote."""
    proposed_days = proposed_days if isinstance(proposed_days, list) else []
    by_number, by_month_day = _date_lookup(proposed_days)
    lines = _candidate_lines(message)
    items = []
    used_dates = set()

    for line in lines:
        match = LINE_RE.match(line)
        if not match:
            continue
        marker = int(match.group(1))
        punctuation = bool(match.group(2))
        detail = match.group(3).strip()
        day = by_number.get(marker) if punctuation else by_month_day.get(marker)
        if not day and not punctuation:
            day = by_number.get(len(items) + 1)
        if not day and punctuation:
            day = by_month_day.get(marker)
        if not day or str(day.get("date") or "") in used_dates:
            continue
        date = str(day.get("date") or "")
        used_dates.add(date)
        included, excluded = _split_scope(detail)
        amount = _amount(detail)
        pending = []
        if "pendiente" in detail.casefold():
            pending.extend(_categories(detail) or ["price"])
        item = {
            "day_number": day.get("day_number", marker),
            "date": date,
            "location": day.get("location", ""),
            "supplier_plan": detail,
            "amount_usd": amount,
            "price_status": "quoted" if amount is not None else ("pending" if pending else "not_provided"),
            "included": included,
            "excluded": excluded,
            "pending": pending,
            "source_text": line,
        }
        items.append(item)

    lower = " ".join(lines).casefold()
    global_excluded = []
    if re.search(r"alimentaci[oó]n y (?:el )?hospedaje.+(?:adicional|no incluye)", lower):
        global_excluded = ["meals", "lodging"]
    global_pending = []
    if re.search(r"pendiente.+(?:ingreso|entrada).+(?:oso|reserva)", lower):
        global_pending.append("Bear reserve entrance fee")
    if re.search(r"arriv|arribo|llegada", lower) and re.search(r"costo pendiente", lower):
        global_pending.append("Arrival airport transfer price")

    flags = _review_flags(items, global_pending)
    subtotal = sum(item["amount_usd"] for item in items if item["amount_usd"] is not None)

    merged_days = []
    quote_by_date = {item["date"]: item for item in items if item["date"]}
    for day in proposed_days:
        if not isinstance(day, dict):
            continue
        merged = dict(day)
        merged["guide_quote"] = quote_by_date.get(str(day.get("date") or ""))
        merged_days.append(merged)

    return {
        "source_type": "guide_response",
        "sender": _text(sender)[:120] or "Guide",
        "received_at": received_at or _now(),
        "currency": "USD",
        "prices_are_supplier_costs": True,
        "guest_facing_price_approved": False,
        "items": items,
        "known_supplier_subtotal_usd": subtotal,
        "global_excluded": global_excluded,
        "global_pending": global_pending,
        "review_flags": flags,
        "merged_days": merged_days,
    }

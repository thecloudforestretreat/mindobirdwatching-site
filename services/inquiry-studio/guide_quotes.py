"""Deterministically structure guide and supplier quote messages.

The source message remains authoritative. This parser creates a review aid; it
does not turn supplier prices into guest-facing prices or confirmed services.
"""

from __future__ import annotations

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
    include_at = re.search(r"\bincluye\b", lowered)
    exclude_at = re.search(r"\bno incluye\b", lowered)
    included = []
    excluded = []
    if include_at:
        end = exclude_at.start() if exclude_at and exclude_at.start() > include_at.start() else len(value)
        included = _categories(value[include_at.end() : end])
    if exclude_at:
        excluded = _categories(value[exclude_at.end() :])
    return included, excluded


def _candidate_lines(message):
    lines = []
    for raw in str(message or "").splitlines():
        line = _text(WHATSAPP_RE.sub("", raw))
        if line:
            lines.append(line)
    return lines


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

    flags = []
    for item in items:
        label = item["date"] or f"Day {item['day_number']}"
        if item["price_status"] == "pending":
            flags.append(f"Confirm the price for {label}.")
        if "entrance fees" in item["excluded"]:
            flags.append(f"Confirm the excluded entrance fee for {label}.")
        source = item["supplier_plan"].casefold()
        if ("o si" in source or "opci" in source) and item["amount_usd"] is not None:
            flags.append(f"Confirm which optional activity is covered by the {label} price.")
        if item["amount_usd"] is not None and not item["included"] and not item["excluded"]:
            flags.append(f"Confirm the inclusions for the {label} price.")
    flags.extend(f"Confirm {value.lower()}." for value in global_pending)
    flags = list(dict.fromkeys(flags))
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

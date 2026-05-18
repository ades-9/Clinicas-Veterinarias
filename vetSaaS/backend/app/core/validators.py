"""Validadores comunes (cédula ecuatoriana, teléfono EC, etc.)."""

import re

_DIGITS_ONLY = re.compile(r"^\d+$")


def validate_ecuador_id(value: str) -> str:
    """Valida una cédula ecuatoriana (10 dígitos + dígito verificador).

    Devuelve el string limpio (solo dígitos) si es válida; lanza ValueError si no.
    """
    if value is None:
        raise ValueError("La cédula es obligatoria")
    cleaned = re.sub(r"\D", "", value)
    if len(cleaned) != 10:
        raise ValueError("La cédula debe tener exactamente 10 dígitos")
    province = int(cleaned[:2])
    if province < 1 or province > 24:
        raise ValueError("Cédula inválida: código de provincia incorrecto")
    third = int(cleaned[2])
    if third > 5:
        raise ValueError("Cédula inválida: tercer dígito incorrecto")

    coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    total = 0
    for i, coef in enumerate(coefficients):
        product = int(cleaned[i]) * coef
        if product >= 10:
            product -= 9
        total += product
    verifier = (10 - (total % 10)) % 10
    if verifier != int(cleaned[9]):
        raise ValueError("Cédula inválida: dígito verificador incorrecto")
    return cleaned


def validate_phone_ec(value: str) -> str:
    """Valida un teléfono de 10 dígitos (solo dígitos). Devuelve el string limpio."""
    if value is None:
        raise ValueError("El teléfono es obligatorio")
    cleaned = re.sub(r"\D", "", value)
    if len(cleaned) != 10:
        raise ValueError("El teléfono debe tener exactamente 10 dígitos")
    if not _DIGITS_ONLY.match(cleaned):
        raise ValueError("El teléfono solo puede contener números")
    return cleaned

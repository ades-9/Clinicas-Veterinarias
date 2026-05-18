// Algoritmo oficial de cédula ecuatoriana (10 dígitos + dígito verificador).
// Devuelve null si es válida, o el mensaje de error.
export function validateEcuadorId(value: string): string | null {
  const cleaned = value.replace(/\D/g, "")
  if (cleaned.length !== 10) return "La cédula debe tener 10 dígitos"
  const province = parseInt(cleaned.slice(0, 2), 10)
  if (province < 1 || province > 24) return "Código de provincia inválido"
  const third = parseInt(cleaned[2], 10)
  if (third > 5) return "Tercer dígito de cédula inválido"

  const coefficients = [2, 1, 2, 1, 2, 1, 2, 1, 2]
  let total = 0
  for (let i = 0; i < 9; i++) {
    let product = parseInt(cleaned[i], 10) * coefficients[i]
    if (product >= 10) product -= 9
    total += product
  }
  const verifier = (10 - (total % 10)) % 10
  if (verifier !== parseInt(cleaned[9], 10)) return "Cédula inválida (dígito verificador)"
  return null
}

export function sanitizeDigits(value: string, maxLength: number): string {
  return value.replace(/\D/g, "").slice(0, maxLength)
}

export function validatePhone10(value: string): string | null {
  const cleaned = value.replace(/\D/g, "")
  if (cleaned.length === 0) return null
  if (cleaned.length !== 10) return "El teléfono debe tener 10 dígitos"
  return null
}

// Acepta input con coma o punto decimal y devuelve el string normalizado a punto.
// Solo permite dígitos, un solo separador decimal (',' o '.').
export function sanitizeWeightInput(raw: string): string {
  // Reemplazar coma por punto y filtrar caracteres no permitidos
  let s = raw.replace(",", ".")
  s = s.replace(/[^0-9.]/g, "")
  // Permitir solo un punto decimal
  const firstDot = s.indexOf(".")
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, "")
  }
  return s
}

export function validateWeight(raw: string): string | null {
  if (!raw.trim()) return null
  const n = parseFloat(raw.replace(",", "."))
  if (isNaN(n)) return "El peso debe ser numérico"
  if (n <= 0) return "El peso debe ser mayor a 0"
  if (n > 500) return "El peso parece inválido"
  return null
}

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA")
}

export function validateBirthDate(value: string): string | null {
  if (!value) return null
  if (value > todayISO()) return "La fecha de nacimiento no puede ser futura"
  return null
}

import { useAuth } from "@clerk/clerk-react"
import { useMemo } from "react"

const BASE_URL = "/api/v1"

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {}
): Promise<T> {
  const { token, ...init } = options
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!res.ok) {
    const rawBody = await res.text().catch(() => "")
    console.error(`[API ERROR] ${options.method ?? "GET"} ${path} → ${res.status} ${res.statusText}\nBody: ${rawBody}`)
    let detail: string
    try {
      const parsed = JSON.parse(rawBody)
      detail = parsed.detail ?? "Error inesperado"
    } catch {
      detail = res.statusText
    }
    throw new Error(detail)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function useApiClient() {
  const { getToken } = useAuth()

  return useMemo(() => {
    async function get<T>(path: string): Promise<T> {
      const token = await getToken()
      return request<T>(path, { method: "GET", token: token ?? undefined })
    }

    async function post<T>(path: string, body?: unknown): Promise<T> {
      const token = await getToken()
      return request<T>(path, {
        method: "POST",
        token: token ?? undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    }

    async function patch<T>(path: string, body?: unknown): Promise<T> {
      const token = await getToken()
      return request<T>(path, {
        method: "PATCH",
        token: token ?? undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    }

    async function put<T>(path: string, body?: unknown): Promise<T> {
      const token = await getToken()
      return request<T>(path, {
        method: "PUT",
        token: token ?? undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      })
    }

    async function del(path: string): Promise<void> {
      const token = await getToken()
      return request<void>(path, { method: "DELETE", token: token ?? undefined })
    }

    async function upload<T>(path: string, formData: FormData): Promise<T> {
      const token = await getToken()
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(error.detail ?? "Error inesperado")
      }
      return res.json()
    }

    // Descarga un archivo del backend (GET) y dispara el guardado en disco.
    // Toma el filename del header Content-Disposition si está, o usa el fallback.
    async function download(path: string, fallbackName: string): Promise<void> {
      const token = await getToken()
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        const error = await res.text().catch(() => res.statusText)
        throw new Error(error || "No se pudo descargar el archivo")
      }
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="?([^"]+)"?/)
      const filename = match ? match[1] : fallbackName

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }

    return { get, post, patch, put, del, upload, download }
  }, [getToken])
}

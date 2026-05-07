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
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? "Error inesperado")
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

    return { get, post, patch, del, upload }
  }, [getToken])
}

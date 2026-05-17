import { useQuery } from "@tanstack/react-query"
import { useApiClient } from "@/api/client"
import type { User } from "@/types"

export interface Me {
  user: User
  permissions: string[]
}

export function useMe() {
  const api = useApiClient()
  return useQuery({
    queryKey: ["auth-me"],
    queryFn: () => api.get<Me>("/auth/me"),
    staleTime: 5 * 60_000,
  })
}

export interface PermissionsApi {
  isLoading: boolean
  can: (action: string) => boolean
  canAny: (actions: string[]) => boolean
  user?: User
  role?: string
}

export function usePermissions(): PermissionsApi {
  const { data, isLoading } = useMe()
  const set = new Set(data?.permissions ?? [])
  const isSuperadmin = data?.user.role_name === "superadmin"
  return {
    isLoading,
    can: (action) => isSuperadmin || set.has(action),
    canAny: (actions) => isSuperadmin || actions.some((a) => set.has(a)),
    user: data?.user,
    role: data?.user.role_name,
  }
}

import { useUser } from "@clerk/clerk-react"

export function useOnboarding() {
  const { user, isLoaded } = useUser()

  const isOnboarded = Boolean(
    user?.publicMetadata?.clinic_id && user?.publicMetadata?.role
  )

  return { isOnboarded, isLoading: !isLoaded }
}

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"
import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "info"

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showSuccess: (message: string) => void
  showError: (message: string) => void
  showInfo: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION: Record<ToastVariant, number> = {
  success: 3000,
  info: 3500,
  error: 5000,
}

let nextId = 1

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((curr) => curr.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId++
      setToasts((curr) => [...curr, { id, message, variant }])
      setTimeout(() => dismiss(id), DURATION[variant])
    },
    [dismiss]
  )

  const value: ToastContextValue = {
    showSuccess: (m) => push("success", m),
    showError: (m) => push("error", m),
    showInfo: (m) => push("info", m),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  const Icon = toast.variant === "success" ? CheckCircle2 : toast.variant === "error" ? AlertCircle : Info

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg transition-all duration-200",
        visible ? "translate-x-0 opacity-100" : "translate-x-4 opacity-0",
        toast.variant === "success" && "border-emerald-200 bg-emerald-50",
        toast.variant === "error" && "border-destructive/30 bg-destructive/10",
        toast.variant === "info" && "border-border bg-card"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0 mt-0.5",
          toast.variant === "success" && "text-emerald-600",
          toast.variant === "error" && "text-destructive",
          toast.variant === "info" && "text-muted-foreground"
        )}
      />
      <p
        className={cn(
          "flex-1 text-sm",
          toast.variant === "success" && "text-emerald-900",
          toast.variant === "error" && "text-destructive",
          toast.variant === "info" && "text-foreground"
        )}
      >
        {toast.message}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>")
  }
  return ctx
}

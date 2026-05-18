import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  page: number          // 1-based
  pageSize: number
  total: number
  onChange: (page: number) => void
}

export function Pagination({ page, pageSize, total, onChange }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{total} registro{total === 1 ? "" : "s"}</span>
      </div>
    )
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        Mostrando {start}–{end} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers(page, totalPages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-2 text-muted-foreground">…</span>
          ) : (
            <Button
              key={p}
              type="button"
              variant={p === page ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(p)}
            >
              {p}
            </Button>
          )
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// Devuelve la lista de números de página a mostrar, con elipsis cuando hay muchos.
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  if (start > 2) pages.push("…")
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push("…")
  pages.push(total)
  return pages
}

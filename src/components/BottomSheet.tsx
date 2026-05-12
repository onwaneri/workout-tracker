import { useEffect, useRef, type ReactNode } from 'react'

export function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-2xl bg-[color:var(--color-bg)] border-t border-[color:var(--color-border)] p-4 pb-8 max-h-[80vh] overflow-y-auto animate-slide-up">
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
        {children}
      </div>
    </div>
  )
}

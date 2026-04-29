import type { ReactNode } from 'react'

export function Screen({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="flex flex-col flex-1 min-h-0">
      <header className="flex items-center justify-between px-5 pt-6 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {action}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-32 md:pb-8">{children}</div>
    </section>
  )
}

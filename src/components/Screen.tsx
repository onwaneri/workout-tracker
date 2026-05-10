import type { ReactNode } from 'react'

interface ScreenProps {
  title: string
  children: ReactNode
  action?: ReactNode
  eyebrow?: string
}

export function Screen({ title, children, action, eyebrow }: ScreenProps) {
  return (
    <section className="flex flex-col flex-1 min-h-0">
      <header className="flex items-end justify-between px-5 pt-6 pb-4">
        <div>
          {eyebrow && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-muted)',
              marginBottom: 4,
            }}>
              {eyebrow}
            </div>
          )}
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: eyebrow ? 32 : 28,
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            margin: 0,
            color: 'var(--color-text)',
          }}>
            {title}
          </h1>
        </div>
        {action}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-32 md:pb-8">{children}</div>
    </section>
  )
}

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary: 'bg-[color:var(--color-accent)] text-white hover:opacity-90 active:opacity-80',
  secondary:
    'bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[color:var(--color-text)] hover:bg-white/5',
  ghost: 'text-[color:var(--color-text)] hover:bg-white/5',
  danger: 'bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/20',
}

const sizes: Record<Size, string> = {
  md: 'min-h-[44px] px-4 text-sm',
  lg: 'min-h-[52px] px-5 text-base',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; children: ReactNode }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

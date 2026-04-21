import * as React from 'react'
import { cn } from './utils/cn'

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
  },
) {
  const { className, variant = 'primary', size = 'md', ...rest } = props
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:translate-y-[1px] disabled:opacity-50 disabled:pointer-events-none'
  const sizes = {
    md: 'h-11 px-4 text-[15px]',
    lg: 'h-12 px-5 text-[16px]',
  }[size]
  const variants = {
    primary:
      'bg-slate-900 text-white hover:bg-slate-800 shadow-[0_10px_30px_-15px_rgba(15,23,42,0.6)]',
    secondary:
      'bg-white/80 text-slate-900 hover:bg-white border border-slate-200 shadow-sm',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  }[variant]
  return <button className={cn(base, sizes, variants, className)} {...rest} />
}

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  const { className, ...rest } = props
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200 bg-white/80 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.55)]',
        className,
      )}
      {...rest}
    />
  )
}

export function Badge(props: React.HTMLAttributes<HTMLSpanElement>) {
  const { className, ...rest } = props
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700',
        className,
      )}
      {...rest}
    />
  )
}

export function FieldLabel(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  const { className, ...rest } = props
  return (
    <label
      className={cn('text-sm font-bold text-slate-900', className)}
      {...rest}
    />
  )
}

export function Segmented(
  props: React.HTMLAttributes<HTMLDivElement> & {
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string; icon?: React.ReactNode }[]
  },
) {
  const { className, value, onChange, options, ...rest } = props
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1',
        className,
      )}
      {...rest}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-[15px] font-extrabold transition',
              active
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:bg-white/70',
            )}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function ProgressBar(props: { value: number }) {
  const v = Math.max(0, Math.min(100, props.value))
  return (
    <div className="h-3 w-full rounded-full bg-slate-200/80">
      <div
        className="h-3 rounded-full bg-gradient-to-r from-sky-400 via-indigo-400 to-violet-400 transition-[width]"
        style={{ width: `${v}%` }}
      />
    </div>
  )
}

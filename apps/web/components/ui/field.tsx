import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

const control =
  'w-full min-h-[46px] rounded-xl border bg-background px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-danger'

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string | undefined
  hint?: string | undefined
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-sm text-muted-foreground">
        {label}
        {hint && <span className="ml-1 font-normal text-muted-foreground">({hint})</span>}
      </span>
      {children}
      {error && (
        <span role="alert" className="block text-sm text-danger">
          {error}
        </span>
      )}
    </label>
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'appearance-none pr-8', className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24 py-2', className)} {...props} />
}

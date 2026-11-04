import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { on?: boolean; label: string; children: ReactNode }
export function IconButton({ on, label, children, className = '', ...rest }: Props) {
  return <button className={`icon-btn no-drag ${on ? 'on' : ''} ${className}`} aria-label={label} title={label} {...rest}>{children}</button>
}

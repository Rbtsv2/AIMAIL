import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'quiet' | 'danger'
  icon?: ReactNode
}
export function Button({ variant = 'quiet', icon, children, className = '', ...rest }: Props) {
  return <button className={`btn ${variant} ${className}`} {...rest}>{icon}{children}</button>
}

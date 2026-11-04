import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react'

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`field ${p.className ?? ''}`} />
export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`field ${p.className ?? ''}`} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`field ${p.className ?? ''}`} />

export function Row({ label, hint, children, column }: { label: string; hint?: string; children?: React.ReactNode; column?: boolean }) {
  return (
    <div className={`frow ${column ? 'col' : ''}`}>
      <div className="lab">{label}{hint && <small>{hint}</small>}</div>
      {children}
    </div>
  )
}
export const Group = ({ children }: { children: React.ReactNode }) => <div className="group">{children}</div>

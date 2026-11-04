// src/renderer/src/lib/text.ts
import type { Address } from '@shared/models/Message'

// noms des comptes de l’utilisateur, pour afficher le nom du compte à la place de l’adresse brute
const ownNames = new Map<string, string>()
export const setOwnNames = (entries: { email: string; name: string }[]): void => { ownNames.clear(); for (const e of entries) if (e.name.trim()) ownNames.set(e.email.toLowerCase(), e.name.trim()) }

export const initials = (a: Address): string => {
  const n = (a.name || ownNames.get(a.address.toLowerCase()) || a.address).trim()
  const parts = n.split(/[\s.@_-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

export const colorFor = (s: string): string => {
  const palette = ['#4f6bed', '#2eaf8a', '#e0745a', '#8e5bd8', '#d6a42c', '#3c9bd9', '#c75b9b', '#5a9a3c']
  let h = 0
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return palette[h % palette.length]
}

export const displayName = (a: Address): string => a.name || ownNames.get(a.address.toLowerCase()) || a.address.split('@')[0]

export const formatSize = (n: number): string =>
  n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(0)} Ko` : `${(n / 1048576).toFixed(1)} Mo`

export const parseAddresses = (s: string): Address[] =>
  s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = x.match(/^"?([^"<]*)"?\s*<([^>]+)>$/)
    return m ? { name: m[1].trim(), address: m[2].trim() } : { name: '', address: x }
  })

export const isEmail = (s: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
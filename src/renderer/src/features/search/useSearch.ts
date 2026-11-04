// src/renderer/src/features/search/useSearch.ts
import { useEffect, useState } from 'react'
import { useMail } from '@/stores/mail.store'

export function useDebouncedSearch(delay = 120) {
  const search = useMail((s) => s.search)
  const setSearch = useMail((s) => s.setSearch)
  const [local, setLocal] = useState(search)
  useEffect(() => setLocal(search), [search])
  useEffect(() => { const t = setTimeout(() => { if (local !== search) setSearch(local) }, delay); return () => clearTimeout(t) }, [local])
  return [local, setLocal] as const
}
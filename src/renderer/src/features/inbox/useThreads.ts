import { useEffect, useRef } from 'react'
import { useMail } from '@/stores/mail.store'

export function useInfiniteThreads() {
  const ref = useRef<HTMLDivElement>(null)
  const loadMore = useMail((s) => s.loadMore)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const h = () => { if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) void loadMore() }
    el.addEventListener('scroll', h, { passive: true })
    return () => el.removeEventListener('scroll', h)
  }, [loadMore])
  return ref
}

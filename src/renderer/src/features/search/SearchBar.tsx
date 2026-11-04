import { Search, X } from 'lucide-react'
import { useDebouncedSearch } from './useSearch'

export function SearchBar() {
  const [q, setQ] = useDebouncedSearch()
  return (
    <div className="list-search no-drag">
      <Search size={14} />
      <input value={q} placeholder="Rechercher" onChange={(e) => setQ(e.target.value)} />
      {q && <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setQ('')}><X size={12} /></button>}
    </div>
  )
}

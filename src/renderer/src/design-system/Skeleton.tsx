export function RowSkeleton() {
  return (
    <div className="row" style={{ pointerEvents: 'none' }}>
      <div />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
        <div className="skeleton" style={{ width: '45%' }} />
        <div className="skeleton" style={{ width: '80%' }} />
        <div className="skeleton" style={{ width: '65%', opacity: 0.6 }} />
      </div>
    </div>
  )
}

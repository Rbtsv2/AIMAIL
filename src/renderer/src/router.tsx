import { useAccounts } from '@/stores/accounts.store'
import { Shell } from '@/layout/Shell'
import { Onboarding } from '@/features/accounts/AddAccountFlow'

export function Router() {
  const loaded = useAccounts((s) => s.loaded)
  const count = useAccounts((s) => s.accounts.length)
  if (!loaded) return null
  return count === 0 ? <Onboarding /> : <Shell />
}

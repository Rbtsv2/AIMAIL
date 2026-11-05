// src/renderer/src/stores/ui.store.ts
import { create } from 'zustand'

export type Toast = { id: string; text: string; action?: { label: string; fn: () => void }; ttl?: number }

import type { Draft } from '@shared/models/Draft'

interface UiState {
  sidebarCollapsed: boolean
  paletteOpen: boolean
  settingsOpen: boolean
  settingsPane: 'general' | 'accounts' | 'signatures' | 'ai' | 'sources' | 'rules' | 'appearance' | 'backup'
  addAccountOpen: boolean
  contactsOpen: boolean
  calendarOpen: boolean
  toasts: Toast[]
  confirmSend: { draft: Draft; resolve: (ok: boolean) => void } | null
  askConfirmSend(draft: Draft): Promise<boolean>
  ruleDraft: { accountId: string; from: string; name: string } | null
  openRuleFor(d: { accountId: string; from: string; name: string }): void
  confirmReq: { title: string; body?: string; okLabel?: string; cancelLabel?: string; danger?: boolean; resolve: (ok: boolean) => void } | null
  confirm(o: { title: string; body?: string; okLabel?: string; cancelLabel?: string; danger?: boolean }): Promise<boolean>
  toggleSidebar(): void
  setPalette(v: boolean): void
  openSettings(pane?: UiState['settingsPane']): void
  closeSettings(): void
  setAddAccount(v: boolean): void
  setContacts(v: boolean): void
  setCalendar(v: boolean): void
  toast(t: Omit<Toast, 'id'>): string
  dismissToast(id: string): void
}

export const useUi = create<UiState>((set, get) => ({
  sidebarCollapsed: false, paletteOpen: false, settingsOpen: false, settingsPane: 'general', addAccountOpen: false, contactsOpen: false, calendarOpen: false, toasts: [],
  confirmSend: null,
  ruleDraft: null,
  openRuleFor: (d) => { set({ ruleDraft: d }); get().openSettings('rules') },
  confirmReq: null,
  confirm: (o) => new Promise<boolean>((resolve) => set({ confirmReq: { ...o, resolve: (ok) => { set({ confirmReq: null }); resolve(ok) } } })),
  askConfirmSend: (draft) => new Promise<boolean>((resolve) => set({ confirmSend: { draft, resolve: (ok) => { set({ confirmSend: null }); resolve(ok) } } })),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setPalette: (v) => set({ paletteOpen: v }),
  openSettings: (pane) => set({ settingsOpen: true, addAccountOpen: false, contactsOpen: false, calendarOpen: false, settingsPane: pane ?? get().settingsPane }),
  closeSettings: () => set({ settingsOpen: false }),
  setAddAccount: (v) => set({ addAccountOpen: v, settingsOpen: v ? false : get().settingsOpen, contactsOpen: v ? false : get().contactsOpen, calendarOpen: v ? false : get().calendarOpen }),
  setContacts: (v) => set({ contactsOpen: v, settingsOpen: v ? false : get().settingsOpen, addAccountOpen: v ? false : get().addAccountOpen, calendarOpen: v ? false : get().calendarOpen }),
  setCalendar: (v) => set({ calendarOpen: v, settingsOpen: v ? false : get().settingsOpen, addAccountOpen: v ? false : get().addAccountOpen, contactsOpen: v ? false : get().contactsOpen }),
  toast: (t) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }))
    setTimeout(() => get().dismissToast(id), t.ttl ?? 4000)
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))
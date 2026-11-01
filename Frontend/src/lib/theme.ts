// Theme manager — one source of truth for light / dark (EAP lib/theme.ts).
//
// The PREFERENCE is three-valued: 'light' | 'dark' | 'system' (follow the device). It lives
// in localStorage under the SHARED key `ote:theme` (all of Ote's apps use it), and
// index.html reads it before the stylesheet so the first paint is already right.
// First visit = 'system' (Ote U3); if the device can't be asked, DARK — never flash-bang.

import { useSyncExternalStore } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'ote:theme'
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null

let currentPref: ThemePref = readStored() ?? 'system'
const listeners = new Set<() => void>()

function readStored(): ThemePref | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : null
  } catch {
    return null
  }
}

export function resolveTheme(pref: ThemePref = currentPref): Theme {
  if (pref === 'system') return media?.matches ? 'light' : 'dark'
  return pref
}

function paint(theme: Theme, animate: boolean) {
  const el = document.documentElement
  if (el.dataset.theme !== theme) {
    if (animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('theme-anim')
      window.setTimeout(() => el.classList.remove('theme-anim'), 450)
    }
    el.dataset.theme = theme
  }
  // Keep the mobile browser chrome in the same family. Read --bg from the stylesheet so
  // the colour lives in ONE place (styles/tokens.css), not here.
  const bg = getComputedStyle(el).getPropertyValue('--bg').trim()
  if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
}

function emit() {
  for (const fn of listeners) fn()
}

media?.addEventListener?.('change', () => {
  if (currentPref === 'system') {
    paint(resolveTheme('system'), true)
    emit()
  }
})

/** Apply a preference: paint it, remember it for the next boot, tell subscribers. */
export function setThemePref(pref: ThemePref, { animate = true } = {}) {
  currentPref = pref
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    /* storage blocked — still applies for this page */
  }
  paint(resolveTheme(pref), animate)
  emit()
}

export function getThemePref(): ThemePref {
  return currentPref
}

/** Sync the document with the stored preference (called once at startup). */
export function initTheme() {
  paint(resolveTheme(currentPref), false)
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** React view of the preference + the theme it resolves to right now. */
export function useTheme(): { pref: ThemePref; theme: Theme; setPref: (p: ThemePref) => void } {
  const pref = useSyncExternalStore(subscribe, getThemePref)
  const theme = useSyncExternalStore(subscribe, () => resolveTheme(currentPref))
  return { pref, theme, setPref: setThemePref }
}

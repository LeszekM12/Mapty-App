// ─── TYPED DOM HELPERS ───────────────────────────────────────────────────────

/** querySelector that throws if element not found */
export function qs<T extends Element>(selector: string, parent: ParentNode = document): T {
  const el = parent.querySelector<T>(selector);
  if (!el) throw new Error(`Element not found: "${selector}"`);
  return el;
}

/** getElementById that throws if element not found */
export function qid<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`#${id} not found`);
  return el;
}

/** Safe getElementById — returns null instead of throwing */
export function qidSafe<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/** Show/hide via .hidden class */
export function show(el: HTMLElement | null): void  { el?.classList.remove('hidden'); }
export function hide(el: HTMLElement | null): void  { el?.classList.add('hidden'); }
export function toggle(el: HTMLElement | null, visible: boolean): void {
  el?.classList.toggle('hidden', !visible);
}

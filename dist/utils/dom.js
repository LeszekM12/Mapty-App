// ─── TYPED DOM HELPERS ───────────────────────────────────────────────────────
/** querySelector that throws if element not found */
export function qs(selector, parent = document) {
    const el = parent.querySelector(selector);
    if (!el)
        throw new Error(`Element not found: "${selector}"`);
    return el;
}
/** getElementById that throws if element not found */
export function qid(id) {
    const el = document.getElementById(id);
    if (!el)
        throw new Error(`#${id} not found`);
    return el;
}
/** Safe getElementById — returns null instead of throwing */
export function qidSafe(id) {
    return document.getElementById(id);
}
/** Show/hide via .hidden class */
export function show(el) { el?.classList.remove('hidden'); }
export function hide(el) { el?.classList.add('hidden'); }
export function toggle(el, visible) {
    el?.classList.toggle('hidden', !visible);
}
//# sourceMappingURL=dom.js.map
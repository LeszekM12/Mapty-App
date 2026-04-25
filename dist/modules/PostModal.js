// ─── POST MODAL ───────────────────────────────────────────────────────────────
// src/modules/PostModal.ts
//
// Bottom-sheet for creating a text/photo post shown in the Home feed.
// Stored locally in IndexedDB (postsFeed table) + localStorage fallback.
import { savePost } from './db.js';
// ── Build HTML ────────────────────────────────────────────────────────────────
function buildHTML() {
    return `
  <div class="pm-overlay" id="postModalOverlay" role="dialog" aria-modal="true">
    <div class="pm-sheet" id="postModalSheet">
      <div class="pm-handle"></div>

      <div class="pm-header">
        <h2 class="pm-header__title">New Post</h2>
        <button class="pm-close" id="pmClose" aria-label="Close">✕</button>
      </div>

      <div class="pm-body">

        <div class="pm-field">
          <label class="pm-label" for="pmTitle">Title</label>
          <input class="pm-input" id="pmTitle" type="text"
            placeholder="What's your post about?" maxlength="80" autocomplete="off"/>
        </div>

        <div class="pm-field">
          <label class="pm-label" for="pmDesc">
            Description
            <span class="pm-char-count" id="pmDescCount">0/500</span>
          </label>
          <textarea class="pm-textarea" id="pmDesc" rows="5"
            maxlength="500" placeholder="Share your story, thoughts or experience…"></textarea>
        </div>

        <div class="pm-field">
          <label class="pm-label">Photo <span class="pm-optional">(optional)</span></label>
          <div class="pm-photo-zone" id="pmPhotoZone">
            <input type="file" accept="image/*" id="pmPhotoInput" class="pm-photo-input"/>
            <div class="pm-photo-placeholder" id="pmPhotoPlaceholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
              <span>Add photo</span>
            </div>
            <img class="pm-photo-preview hidden" id="pmPhotoPreview" alt="Preview"/>
            <button class="pm-photo-remove hidden" id="pmPhotoRemove" aria-label="Remove photo">✕</button>
          </div>
        </div>

      </div>

      <div class="pm-footer">
        <button class="pm-btn pm-btn--cancel" id="pmCancel">Cancel</button>
        <button class="pm-btn pm-btn--post" id="pmPost">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="15" height="15">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Post
        </button>
      </div>
    </div>
  </div>`;
}
// ── PostModal class ───────────────────────────────────────────────────────────
export class PostModal {
    constructor(_onSave) {
        Object.defineProperty(this, "_onSave", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: _onSave
        });
        Object.defineProperty(this, "_el", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_photoB64", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "_touchStartY", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    open() {
        document.getElementById('postModalOverlay')?.remove();
        const wrapper = document.createElement('div');
        wrapper.innerHTML = buildHTML();
        const el = wrapper.firstElementChild;
        document.body.appendChild(el);
        this._el = el;
        requestAnimationFrame(() => {
            el.classList.add('pm-overlay--visible');
            setTimeout(() => el.querySelector('.pm-sheet')?.classList.add('pm-sheet--open'), 10);
        });
        this._bindEvents(el);
    }
    close() {
        if (!this._el)
            return;
        this._el.querySelector('.pm-sheet')?.classList.remove('pm-sheet--open');
        this._el.classList.remove('pm-overlay--visible');
        setTimeout(() => { this._el?.remove(); this._el = null; }, 350);
    }
    _bindEvents(el) {
        el.querySelector('#pmClose')?.addEventListener('click', () => this.close());
        el.querySelector('#pmCancel')?.addEventListener('click', () => this.close());
        el.addEventListener('click', e => { if (e.target === el)
            this.close(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape')
            this.close(); }, { once: true });
        // Char count
        const desc = el.querySelector('#pmDesc');
        const count = el.querySelector('#pmDescCount');
        desc.addEventListener('input', () => { count.textContent = `${desc.value.length}/500`; });
        // Photo
        const zone = el.querySelector('#pmPhotoZone');
        const input = el.querySelector('#pmPhotoInput');
        const preview = el.querySelector('#pmPhotoPreview');
        const placeholder = el.querySelector('#pmPhotoPlaceholder');
        const removeBtn = el.querySelector('#pmPhotoRemove');
        zone.addEventListener('click', e => {
            if (e.target.closest('#pmPhotoRemove'))
                return;
            input.click();
        });
        input.addEventListener('change', () => {
            const file = input.files?.[0];
            if (!file)
                return;
            const reader = new FileReader();
            reader.onload = () => {
                this._photoB64 = reader.result;
                preview.src = this._photoB64;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
                removeBtn.classList.remove('hidden');
                zone.classList.add('pm-photo-zone--filled');
            };
            reader.readAsDataURL(file);
        });
        removeBtn.addEventListener('click', () => {
            this._photoB64 = null;
            preview.src = '';
            preview.classList.add('hidden');
            placeholder.classList.remove('hidden');
            removeBtn.classList.add('hidden');
            zone.classList.remove('pm-photo-zone--filled');
            input.value = '';
        });
        // Post
        el.querySelector('#pmPost')?.addEventListener('click', () => void this._submit(el));
        // Swipe to close
        const handle = el.querySelector('.pm-handle');
        const sheet = el.querySelector('.pm-sheet');
        handle.addEventListener('touchstart', e => { this._touchStartY = e.touches[0].clientY; }, { passive: true });
        handle.addEventListener('touchmove', e => {
            const d = e.touches[0].clientY - this._touchStartY;
            if (d > 0) {
                sheet.style.transition = 'none';
                sheet.style.transform = `translateY(${d}px)`;
            }
        }, { passive: true });
        handle.addEventListener('touchend', e => {
            sheet.style.transition = '';
            if (e.changedTouches[0].clientY - this._touchStartY > 100)
                this.close();
            else
                sheet.style.transform = '';
        });
    }
    async _submit(el) {
        const title = el.querySelector('#pmTitle')?.value.trim() ?? '';
        const desc = el.querySelector('#pmDesc')?.value.trim() ?? '';
        if (!title && !desc) {
            el.querySelector('#pmTitle')?.focus();
            el.querySelector('#pmTitle')?.classList.add('pm-input--error');
            return;
        }
        const btn = el.querySelector('#pmPost');
        btn.disabled = true;
        btn.textContent = 'Posting…';
        const post = {
            id: String(Date.now()),
            type: 'post',
            date: Date.now(),
            title: title || desc.slice(0, 60),
            body: desc,
            photoUrl: this._photoB64,
            authorName: localStorage.getItem('mapyou_userName') ?? 'Athlete',
            avatarB64: localStorage.getItem('mapyou_avatar') ?? null,
        };
        await savePost(post);
        this.close();
        this._onSave(post);
    }
}
export function openPostModal(onSave) {
    new PostModal(onSave).open();
}
//# sourceMappingURL=PostModal.js.map
// ─── POST MODAL ───────────────────────────────────────────────────────────────
// src/modules/PostModal.ts
//
// Bottom-sheet for creating a text/photo post shown in the Home feed.
// Stored locally in IndexedDB (postsFeed table) + localStorage fallback.

import { savePost, type PostRecord } from './db.js';
import { getJoinedClubs, addToClubFeed } from './SearchView.js';

// ── Build HTML ────────────────────────────────────────────────────────────────

function buildHTML(): string {
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
            placeholder="What's your post about?" maxlength="20" autocomplete="off"/>
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

      <div class="pm-share-clubs" id="pmShareClubs"></div>
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
  private _el: HTMLElement | null = null;
  private _photoB64: string | null = null;
  private _touchStartY = 0;

  constructor(private _onSave: (post: PostRecord) => void) {}

  open(): void {
    document.getElementById('postModalOverlay')?.remove();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = buildHTML();
    const el = wrapper.firstElementChild as HTMLElement;
    document.body.appendChild(el);
    this._el = el;

    requestAnimationFrame(() => {
      el.classList.add('pm-overlay--visible');
      setTimeout(() => el.querySelector<HTMLElement>('.pm-sheet')?.classList.add('pm-sheet--open'), 10);
    });

    this._bindEvents(el);
  }

  close(): void {
    if (!this._el) return;
    this._el.querySelector<HTMLElement>('.pm-sheet')?.classList.remove('pm-sheet--open');
    this._el.classList.remove('pm-overlay--visible');
    setTimeout(() => { this._el?.remove(); this._el = null; }, 350);
  }

  private _bindEvents(el: HTMLElement): void {
    el.querySelector('#pmClose')?.addEventListener('click', () => this.close());
    el.querySelector('#pmCancel')?.addEventListener('click', () => this.close());
    el.addEventListener('click', e => { if (e.target === el) this.close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.close(); }, { once: true });

    // Char count
    const desc  = el.querySelector<HTMLTextAreaElement>('#pmDesc')!;
    const count = el.querySelector<HTMLElement>('#pmDescCount')!;
    desc.addEventListener('input', () => { count.textContent = `${desc.value.length}/500`; });

    // Photo
    const zone      = el.querySelector<HTMLElement>('#pmPhotoZone')!;
    const input     = el.querySelector<HTMLInputElement>('#pmPhotoInput')!;
    const preview   = el.querySelector<HTMLImageElement>('#pmPhotoPreview')!;
    const placeholder = el.querySelector<HTMLElement>('#pmPhotoPlaceholder')!;
    const removeBtn = el.querySelector<HTMLButtonElement>('#pmPhotoRemove')!;

    zone.addEventListener('click', e => {
      if ((e.target as HTMLElement).closest('#pmPhotoRemove')) return;
      input.click();
    });
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        this._photoB64 = reader.result as string;
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

    // Share to club checkboxes
    const pmShareWrap = el.querySelector<HTMLElement>('#pmShareClubs');
    if (pmShareWrap) {
      const clubs = getJoinedClubs();
      if (clubs.length > 0) {
        pmShareWrap.innerHTML = `
          <div class="sam-share-clubs__inner">
            <div class="sam-share-clubs__title">Share to club</div>
            ${clubs.map(c => `
              <label class="sam-share-clubs__item">
                <input type="checkbox" class="pm-club-check" data-club-id="${c.id}" data-club-name="${c.name}"/>
                <span class="sam-share-clubs__check-icon"></span>
                <span class="sam-share-clubs__name">${c.name}</span>
              </label>`).join('')}
          </div>`;
      }
    }

    // Swipe to close
    const handle = el.querySelector<HTMLElement>('.pm-handle')!;
    const sheet  = el.querySelector<HTMLElement>('.pm-sheet')!;
    handle.addEventListener('touchstart', e => { this._touchStartY = e.touches[0].clientY; }, { passive: true });
    handle.addEventListener('touchmove', e => {
      const d = e.touches[0].clientY - this._touchStartY;
      if (d > 0) { sheet.style.transition = 'none'; sheet.style.transform = `translateY(${d}px)`; }
    }, { passive: true });
    handle.addEventListener('touchend', e => {
      sheet.style.transition = '';
      if (e.changedTouches[0].clientY - this._touchStartY > 100) this.close();
      else sheet.style.transform = '';
    });
  }

  private async _submit(el: HTMLElement): Promise<void> {
    const title = el.querySelector<HTMLInputElement>('#pmTitle')?.value.trim() ?? '';
    const desc  = el.querySelector<HTMLTextAreaElement>('#pmDesc')?.value.trim() ?? '';

    if (!title && !desc) {
      el.querySelector<HTMLInputElement>('#pmTitle')?.focus();
      el.querySelector<HTMLInputElement>('#pmTitle')?.classList.add('pm-input--error');
      return;
    }

    const btn = el.querySelector<HTMLButtonElement>('#pmPost')!;
    btn.disabled = true;
    btn.textContent = 'Posting…';

    const post: PostRecord = {
      id:        String(Date.now()),
      type:      'post',
      date:      Date.now(),
      title:     title || desc.slice(0, 60),
      body:      desc,
      photoUrl:  this._photoB64,
      authorName: localStorage.getItem('mapyou_userName') ?? 'Athlete',
      avatarB64:  localStorage.getItem('mapyou_avatar') ?? null,
    };

    await savePost(post);
    // Share to selected clubs
    const checkedClubs = el.querySelectorAll<HTMLInputElement>('.pm-club-check:checked');
    const userName = localStorage.getItem('mapyou_userName') ?? 'Athlete';
    checkedClubs.forEach(cb => {
      addToClubFeed(cb.dataset.clubId!, {
        id:          `cf_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type:        'post',
        title:       post.title,
        body:        post.body ?? '',
        date:        post.date,
        authorName:  userName,
      });
    });

    this.close();
    this._onSave(post);
  }
}

export function openPostModal(onSave: (post: PostRecord) => void): void {
  new PostModal(onSave).open();
}

(function () {
  // Utility helpers
  const rafThrottle = (fn) => {
    let raf = null;
    return (...args) => {
      if (raf) return;
      raf = requestAnimationFrame(() => { fn(...args); raf = null; });
    };
  };

  const getViewport = () => ({ width: document.documentElement.clientWidth, height: document.documentElement.clientHeight });

  const sanitize = (html) => {
    // Basic, safe-ish sanitizer for this demo (escapes text). Replace with DOMPurify for production when allowing rich HTML.
    const d = document.createElement('div'); d.textContent = html; return d.innerHTML;
  };

  function computePosition(refRect, popRect, preferred = 'top', offset = 8) {
    const viewport = getViewport();
    const oppositeMap = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
    const placements = (() => {
      if (preferred === 'auto') return ['top','bottom','right','left'];
      const opposite = oppositeMap[preferred] || 'bottom';
      return [preferred, opposite, ...['top','bottom','right','left'].filter(p => p !== preferred && p !== opposite)];
    })();

    const pad = 6;
    const fits = (x,y,w,h) => x >= 0 && y >= 0 && x + w <= viewport.width && y + h <= viewport.height;

    for (const p of placements) {
      let left, top;
      if (p === 'top') {
        left = refRect.left + (refRect.width - popRect.width) / 2;
        top = refRect.top - popRect.height - offset;
      } else if (p === 'bottom') {
        left = refRect.left + (refRect.width - popRect.width) / 2;
        top = refRect.bottom + offset;
      } else if (p === 'left') {
        left = refRect.left - popRect.width - offset;
        top = refRect.top + (refRect.height - popRect.height) / 2;
      } else { // right
        left = refRect.right + offset;
        top = refRect.top + (refRect.height - popRect.height) / 2;
      }

      // Shift along cross axis
      left = Math.min(Math.max(left, pad), Math.max(viewport.width - popRect.width - pad, pad));
      top  = Math.min(Math.max(top, pad), Math.max(viewport.height - popRect.height - pad, pad));

      if (fits(left, top, popRect.width, popRect.height)) return { left, top, placement: p };
    }

    // fallback center
    return { left: Math.max((viewport.width - popRect.width) / 2, pad), top: Math.max((viewport.height - popRect.height) / 2, pad), placement: placements[0] };
  }

  // TooltipSystem
  class TooltipSystem {
    constructor() {
      this.tooltip = null;
      this.active = null; // { target, follow, interactive }
      this.showTimer = null;
      this.hideTimer = null;
      this.offset = 8;
      this._reposition = rafThrottle(this._reposition.bind(this));
      this._onMove = this._onMove.bind(this);

      this._initListeners();
    }

    _initListeners() {
      document.addEventListener('mouseover', (e) => {
        const t = e.target.closest('[data-tooltip], [data-tooltip-html]');
        if (!t) return;
        this._prepareShow(t);
      });

      document.addEventListener('mouseout', (e) => {
        const t = e.target.closest('[data-tooltip], [data-tooltip-html]');
        if (!t) return;
        this._prepareHide(t);
      });

      document.addEventListener('focusin', (e) => {
        const t = e.target.closest('[data-tooltip], [data-tooltip-html]');
        if (!t) return;
        this._prepareShow(t, true);
      });

      document.addEventListener('focusout', (e) => {
        const t = e.target.closest('[data-tooltip], [data-tooltip-html]');
        if (!t) return;
        this._prepareHide(t, true);
      });

      window.addEventListener('resize', this._reposition);
      window.addEventListener('scroll', this._reposition, true);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.hide();
      });
    }

    _ensureNode() {
      if (this.tooltip && document.body.contains(this.tooltip)) return this.tooltip;
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'tooltip';
      this.tooltip.setAttribute('role','tooltip');
      this.tooltip.style.position = 'fixed';
      this.tooltip.style.left = '0px';
      this.tooltip.style.top = '0px';
      this.tooltip.tabIndex = -1;
      document.body.appendChild(this.tooltip);
      return this.tooltip;
    }

    _prepareShow(target, isFocus = false) {
      clearTimeout(this.hideTimer);
      const delayAttr = target.getAttribute('data-delay');
      const delay = delayAttr ? parseInt(delayAttr, 10) : 0;
      this.showTimer = setTimeout(() => this.show(target, isFocus), delay || 0);
    }

    _prepareHide(target, isFocus = false) {
      clearTimeout(this.showTimer);
      // short hide delay (avoid flicker)
      this.hideTimer = setTimeout(() => this.hide(), 100);
    }

    show(target, isFocus = false) {
      if (!target || !document.contains(target)) return;
      const useHtml = target.hasAttribute('data-tooltip-html');
      const text = useHtml ? target.getAttribute('data-tooltip-html') : target.getAttribute('data-tooltip') || '';
      if (!text) return;

      const node = this._ensureNode();
      if (useHtml) node.innerHTML = sanitize(text); else node.textContent = text;

      node.dataset.variant = target.getAttribute('data-variant') || '';
      this.active = {
        target,
        follow: target.getAttribute('data-follow') === 'true',
        interactive: target.getAttribute('data-interactive') === 'true',
        preferred: target.getAttribute('data-placement') || 'top'
      };

      // set ARIA
      if (!node.id) node.id = `tooltip-${Math.random().toString(36).slice(2,9)}`;
      target.setAttribute('aria-describedby', node.id);

      node.classList.add('show');
      // if follow: listen to mousemove
      if (this.active.follow) window.addEventListener('mousemove', this._onMove);
      else window.removeEventListener('mousemove', this._onMove);

      this._reposition();
    }

    hide() {
      if (!this.tooltip) return;
      this.tooltip.classList.remove('show');
      if (this.active && this.active.target) this.active.target.removeAttribute('aria-describedby');
      this.active = null;
      window.removeEventListener('mousemove', this._onMove);
      clearTimeout(this.showTimer);
      clearTimeout(this.hideTimer);
    }

    _onMove(e) {
      if (!this.tooltip || !this.active || !this.active.follow) return;
      const node = this.tooltip;
      const vw = getViewport();
      // offset to keep a little distance
      const left = Math.min(Math.max(e.clientX + 10, 6), vw.width - node.offsetWidth - 6);
      const top  = Math.min(Math.max(e.clientY + 10, 6), vw.height - node.offsetHeight - 6);
      node.style.left = `${Math.round(left)}px`;
      node.style.top  = `${Math.round(top)}px`;
      node.dataset.placement = 'bottom'; // not meaningful but keeps arrow style consistent
    }

    _reposition() {
      const node = this.tooltip;
      const state = this.active;
      if (!node || !state || state.follow) return;
      const target = state.target;
      if (!document.contains(target)) { this.hide(); return; }

      // reset so measurement accurate
      node.style.left = '0px'; node.style.top = '0px';
      const refRect = target.getBoundingClientRect();
      const popRect = node.getBoundingClientRect();
      const best = computePosition(refRect, popRect, state.preferred === 'auto' ? 'auto' : (state.preferred || 'top'), this.offset);

      node.style.left = `${Math.round(best.left)}px`;
      node.style.top  = `${Math.round(best.top)}px`;
      node.dataset.placement = best.placement;

      // compute arrow alignment: we want arrow to point at reference center as much as possible.
      if (best.placement === 'top' || best.placement === 'bottom') {
        const refCenter = refRect.left + refRect.width / 2;
        // compute arrow left relative to tooltip
        let arrowLeft = refCenter - best.left;
        // clamp inside tooltip padding (10%..90%)
        const min = Math.max(12, popRect.width * 0.12);
        const max = Math.min(popRect.width - 12, popRect.width * 0.88);
        arrowLeft = Math.max(min, Math.min(max, arrowLeft));
        node.style.setProperty('--arrow-left', `${arrowLeft}px`);
      } else { // left/right
        const refCenter = refRect.top + refRect.height / 2;
        let arrowTop = refCenter - best.top;
        const min = Math.max(8, popRect.height * 0.12);
        const max = Math.min(popRect.height - 8, popRect.height * 0.88);
        arrowTop = Math.max(min, Math.min(max, arrowTop));
        node.style.setProperty('--arrow-top', `${arrowTop}px`);
      }
    }

    destroy() {
      this.hide();
      if (this.tooltip) this.tooltip.remove();
      this.tooltip = null;
      window.removeEventListener('resize', this._reposition);
      window.removeEventListener('scroll', this._reposition, true);
    }
  } // end TooltipSystem

  // PopoverSystem (click-to-open interactive)
  class PopoverSystem {
    constructor() {
      this.active = null; // { trigger, node }
      this.offset = 10;
      this._reposition = rafThrottle(this._reposition.bind(this));
      this._onDocClick = this._onDocClick.bind(this);
      this._onKey = this._onKey.bind(this);

      document.addEventListener('click', (e) => {
        const t = e.target.closest('[data-popover]');
        if (!t) return;
        e.preventDefault();
        if (this.active && this.active.trigger === t) { this.hide(); return; }
        this.show(t, t.getAttribute('data-popover') || '');
      });
    }

    show(trigger, html) {
      this.hide();
      const node = document.createElement('div');
      node.className = 'popover';
      node.tabIndex = -1;
      node.innerHTML = sanitize(html);
      document.body.appendChild(node);

      this.active = { trigger, node };
      trigger.setAttribute('aria-expanded','true');
      this._position(trigger, node);
      requestAnimationFrame(()=> node.classList.add('show'));

      // focus first focusable inside (if any)
      const first = node.querySelector('input, button, [href], [tabindex]:not([tabindex="-1"])');
      (first || node).focus();

      document.addEventListener('click', this._onDocClick);
      document.addEventListener('keydown', this._onKey);
      window.addEventListener('resize', this._reposition);
      window.addEventListener('scroll', this._reposition, true);
    }

    hide() {
      if (!this.active) return;
      const { trigger, node } = this.active;
      node.remove();
      try { trigger.focus(); } catch(e){}
      trigger.setAttribute('aria-expanded','false');
      this.active = null;
      document.removeEventListener('click', this._onDocClick);
      document.removeEventListener('keydown', this._onKey);
      window.removeEventListener('resize', this._reposition);
      window.removeEventListener('scroll', this._reposition, true);
    }

    _onDocClick(e) {
      if (!this.active) return;
      const { node, trigger } = this.active;
      if (node.contains(e.target) || trigger.contains(e.target)) return;
      this.hide();
    }

    _onKey(e) {
      if (e.key === 'Escape') this.hide();
    }

    _position(trigger, node) {
      node.style.left = '0px'; node.style.top = '0px';
      const refRect = trigger.getBoundingClientRect();
      const popRect = node.getBoundingClientRect();
      const pref = trigger.getAttribute('data-placement') || 'bottom';
      const best = computePosition(refRect, popRect, pref, this.offset);
      node.style.left = `${Math.round(best.left)}px`;
      node.style.top  = `${Math.round(best.top)}px`;
    }

    _reposition() {
      if (!this.active) return;
      const { trigger, node } = this.active;
      if (!document.contains(trigger) || !document.contains(node)) { this.hide(); return; }
      this._position(trigger, node);
    }
  } // end PopoverSystem

  // initialize
  const tips = new TooltipSystem();
  const pops = new PopoverSystem();

  // Expose for debugging in console (optional)
  window.__SmartTooltip = tips;
  window.__SmartPopover = pops;
})();

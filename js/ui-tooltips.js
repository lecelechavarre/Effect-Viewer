/* ui-tooltips.js
   ES module exporting TooltipSystem and PopoverSystem
   Author: Senior Developer (GPT-5 Thinking mini)
*/

const DEFAULTS = {
  tooltip: {
    delayShow: 150,
    delayHide: 100,
    offset: 8,
    defaultPlacement: 'top',
  },
  popover: {
    offset: 10,
    defaultPlacement: 'bottom',
    trapFocus: false,
  }
};

/* ---------------------------
   Utilities
   --------------------------- */
function rafThrottle(fn) {
  let raf = null;
  return (...args) => {
    if (raf) return;
    raf = requestAnimationFrame(() => { fn(...args); raf = null; });
  };
}

function sanitizeHTML(str) {
  // Basic sanitizer: escape text. If you need richer HTML, replace with a robust sanitizer.
  const tmp = document.createElement('div');
  tmp.textContent = str;
  return tmp.innerHTML;
}

function findFirstFocusable(el) {
  if (!el) return null;
  return el.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
}

function getViewport() {
  return { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
}

function computePosition(refRect, popRect, preferred, offset = 8) {
  // Determine best of: top, bottom, right, left
  const viewport = getViewport();
  const placements = (function order(pref){
    if (!pref) return ['top','bottom','right','left'];
    const opposite = { top:'bottom', bottom:'top', left:'right', right:'left' }[pref];
    const others = ['top','bottom','right','left'].filter(p => p !== pref && p !== opposite);
    return [pref, opposite, ...others];
  })(preferred);

  const pad = 6;
  const fits = (x, y, w, h) => x >= 0 && y >= 0 && x + w <= viewport.width && y + h <= viewport.height;

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

    // shift along cross-axis to keep inside viewport
    left = Math.min(Math.max(left, pad), Math.max(viewport.width - popRect.width - pad, pad));
    top  = Math.min(Math.max(top, pad), Math.max(viewport.height - popRect.height - pad, pad));

    if (fits(left, top, popRect.width, popRect.height)) return { left, top, placement: p };
  }

  // fallback: center on screen
  return { left: Math.max((viewport.width - popRect.width) / 2, pad), top: Math.max((viewport.height - popRect.height) / 2, pad), placement: placements[0] };
}

/* ---------------------------
   TooltipSystem
   --------------------------- */
export class TooltipSystem {
  constructor(opts = {}) {
    this.options = Object.assign({}, DEFAULTS.tooltip, opts);
    this._tooltipNode = null;    // single reusable DOM node
    this._state = { visibleFor: null, follow: false };
    this._showTimer = null;
    this._hideTimer = null;
    this._onMove = this._onMove.bind(this);
    this._reposition = rafThrottle(this._reposition.bind(this));

    // Delegated listeners
    document.addEventListener('mouseover', (e) => {
      const t = e.target.closest('[data-tooltip]');
      if (!t) return;
      this._prepareShow(t);
    });

    document.addEventListener('mouseout', (e) => {
      const t = e.target.closest('[data-tooltip]');
      if (!t) return;
      this._prepareHide(t);
    });

    document.addEventListener('focusin', (e) => {
      const t = e.target.closest('[data-tooltip]');
      if (!t) return;
      this._prepareShow(t, /*isFocus=*/true);
    });

    document.addEventListener('focusout', (e) => {
      const t = e.target.closest('[data-tooltip]');
      if (!t) return;
      this._prepareHide(t, /*isFocus=*/true);
    });

    // reposition on scroll+resize
    window.addEventListener('resize', this._reposition);
    window.addEventListener('scroll', this._reposition, true);
  }

  _ensureNode() {
    if (this._tooltipNode && document.body.contains(this._tooltipNode)) return this._tooltipNode;
    this._tooltipNode = document.createElement('div');
    this._tooltipNode.className = 'tooltip';
    this._tooltipNode.setAttribute('role', 'tooltip');
    this._tooltipNode.style.position = 'fixed';
    this._tooltipNode.style.left = '0px';
    this._tooltipNode.style.top = '0px';
    this._tooltipNode.tabIndex = -1;
    document.body.appendChild(this._tooltipNode);
    return this._tooltipNode;
  }

  _prepareShow(target, isFocus = false) {
    clearTimeout(this._hideTimer);
    this._showTimer = setTimeout(() => this._show(target, isFocus), this.options.delayShow);
  }

  _prepareHide(target, isFocus = false) {
    clearTimeout(this._showTimer);
    this._hideTimer = setTimeout(() => this._hide(target), this.options.delayHide);
  }

  _show(target, isFocus = false) {
    if (!target || !document.body.contains(target)) return;
    const text = target.getAttribute('data-tooltip') || '';
    if (!text) return;

    const node = this._ensureNode();
    const useHtml = target.hasAttribute('data-tooltip-html');
    node.innerHTML = useHtml ? sanitizeHTML(text) : text;
    node.dataset.variant = target.getAttribute('data-tooltip-variant') || '';
    // see if it should follow cursor
    this._state.follow = target.getAttribute('data-tooltip-follow') === 'true';

    node.classList.add('show');
    node.style.pointerEvents = this._state.follow ? 'none' : 'auto';
    node.setAttribute('aria-hidden', 'false');

    target.setAttribute('aria-describedby', node.id || (node.id = `tooltip-${Math.random().toString(36).slice(2,9)}`));
    this._state.visibleFor = target;

    // if follow -> attach mousemove globally (but throttled by rAF)
    if (this._state.follow) {
      window.addEventListener('mousemove', this._onMove);
    } else {
      window.removeEventListener('mousemove', this._onMove);
    }

    this._reposition(); // initial placement
  }

  _hide(target) {
    // if no target specified, hide current
    const node = this._tooltipNode;
    if (!node) return;

    node.classList.remove('show');
    node.setAttribute('aria-hidden', 'true');
    if (this._state.visibleFor) {
      this._state.visibleFor.removeAttribute('aria-describedby');
      this._state.visibleFor = null;
    }
    this._state.follow = false;
    window.removeEventListener('mousemove', this._onMove);
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
  }

  _onMove(e) {
    // mouse-follow tooltip mode: place near cursor
    const node = this._tooltipNode;
    if (!node || !this._state.follow) return;
    const offset = this.options.offset;
    const vw = getViewport();
    const maxLeft = vw.width - node.offsetWidth - 6;
    const maxTop = vw.height - node.offsetHeight - 6;
    let left = Math.min(Math.max(e.clientX + offset, 6), maxLeft);
    let top  = Math.min(Math.max(e.clientY + offset, 6), maxTop);
    node.style.left = `${Math.round(left)}px`;
    node.style.top  = `${Math.round(top)}px`;
    node.dataset.placement = 'bottom'; // not meaningful but keep consistent
  }

  _reposition() {
    const node = this._tooltipNode;
    const target = this._state.visibleFor;
    if (!node || !target || this._state.follow) return;
    if (!document.contains(target)) { this._hide(); return; }
    // reset so measurement is accurate
    node.style.left = '0px';
    node.style.top  = '0px';
    const refRect = target.getBoundingClientRect();
    const popRect = node.getBoundingClientRect();
    const best = computePosition(refRect, popRect, target.getAttribute('data-tooltip-placement') || this.options.defaultPlacement, this.options.offset);
    node.style.left = `${Math.round(best.left)}px`;
    node.style.top  = `${Math.round(best.top)}px`;
    node.dataset.placement = best.placement;
  }

  destroy() {
    clearTimeout(this._showTimer);
    clearTimeout(this._hideTimer);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('resize', this._reposition);
    window.removeEventListener('scroll', this._reposition, true);
    if (this._tooltipNode) this._tooltipNode.remove();
    this._tooltipNode = null;
    this._state = { visibleFor: null, follow: false };
  }
}

/* ---------------------------
   PopoverSystem
   --------------------------- */
export class PopoverSystem {
  constructor(opts = {}) {
    this.options = Object.assign({}, DEFAULTS.popover, opts);
    this._active = null; // { trigger, popNode, onKey }
    this._reposition = rafThrottle(this._reposition.bind(this));
    window.addEventListener('resize', this._reposition);
    window.addEventListener('scroll', this._reposition, true);
  }

  attach(trigger, htmlContent, opts = {}) {
    if (!trigger) throw new Error('PopoverSystem.attach: missing trigger element');
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      if (this._active && this._active.trigger === trigger) {
        this.hide();
        return;
      }
      this.show(trigger, htmlContent, opts);
    });
  }

  show(trigger, htmlContent, opts = {}) {
    this.hide(); // close previous
    const pop = document.createElement('div');
    pop.className = 'popover';
    pop.tabIndex = -1;
    pop.setAttribute('role', opts.role || 'dialog');
    pop.setAttribute('aria-hidden', 'false');
    pop.innerHTML = sanitizeHTML(htmlContent);
    document.body.appendChild(pop);

    const datasetPlacement = trigger.getAttribute('data-popover-placement') || opts.placement || this.options.defaultPlacement;
    pop.dataset.placement = datasetPlacement;

    this._active = { trigger, pop, opts };

    // ARIA on trigger
    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', pop.id || (pop.id = `popover-${Math.random().toString(36).slice(2,9)}`));

    // position & show
    this._positionPop(trigger, pop, datasetPlacement);
    requestAnimationFrame(() => pop.classList.add('show'));

    // focus management
    const focusTarget = findFirstFocusable(pop) || pop;
    focusTarget.focus();

    // event handlers
    this._onDocClick = (e) => {
      if (!this._active) return;
      const { pop, trigger } = this._active;
      if (pop.contains(e.target) || trigger.contains(e.target)) return;
      this.hide();
    };

    this._onKey = (e) => {
      if (!this._active) return;
      if (e.key === 'Escape') { e.preventDefault(); this.hide(); }
      // simple focus trap if enabled
      if (this.options.trapFocus) {
        if (e.key === 'Tab') this._maintainFocus(e);
      }
    };

    document.addEventListener('click', this._onDocClick);
    document.addEventListener('keydown', this._onKey);
  }

  hide() {
    if (!this._active) return;
    const { trigger, pop } = this._active;
    pop.classList.remove('show');
    pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-controls');
    try { trigger.focus(); } catch(e){ /* ignore */ }
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onKey);
    this._active = null;
  }

  _positionPop(trigger, pop, preferred) {
    // measure after appended
    pop.style.left = '0px';
    pop.style.top = '0px';
    const refRect = trigger.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const best = computePosition(refRect, popRect, preferred, this.options.offset);
    pop.style.left = `${Math.round(best.left)}px`;
    pop.style.top  = `${Math.round(best.top)}px`;
    pop.dataset.placement = best.placement;
  }

  _reposition() {
    if (!this._active) return;
    const { trigger, pop } = this._active;
    if (!document.contains(trigger) || !document.contains(pop)) { this.hide(); return; }
    this._positionPop(trigger, pop, pop.dataset.placement || this.options.defaultPlacement);
  }

  _maintainFocus(e) {
    if (!this._active) return;
    const { pop } = this._active;
    const focusables = Array.from(pop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(Boolean);
    if (focusables.length === 0) {
      e.preventDefault(); return;
    }
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  destroy() {
    this.hide();
    window.removeEventListener('resize', this._reposition);
    window.removeEventListener('scroll', this._reposition, true);
  }
}

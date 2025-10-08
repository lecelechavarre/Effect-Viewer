const DEFAULT = {
  delayShow: 160,
  delayHide: 120,
  offset: 10,
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const $$ = (s, ctx = document) => Array.from(ctx.querySelectorAll(s));

function sanitizeHTML(str) {
  const tmp = document.createElement('div');
  tmp.textContent = str;
  return tmp.innerHTML;
}

/* Single shared tooltip node for non-interactive tooltips */
let sharedTooltip = null;
function ensureSharedTooltip(){
  if (sharedTooltip && document.body.contains(sharedTooltip)) return sharedTooltip;
  sharedTooltip = document.createElement('div');
  sharedTooltip.className = 'tooltip';
  sharedTooltip.setAttribute('role','tooltip');
  sharedTooltip.style.position = 'fixed';
  sharedTooltip.style.left = '0px';
  sharedTooltip.style.top = '0px';
  sharedTooltip.dataset.placement = 'top';
  document.body.appendChild(sharedTooltip);
  return sharedTooltip;
}

/* compute best position (smart placement) */
function computePosition(refRect, popRect, preferred = 'auto', offset = DEFAULT.offset){
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const pads = 6;

  const placements = (pref => {
    if (!pref || pref === 'auto') return ['top','bottom','right','left'];
    const opposite = { top:'bottom', bottom:'top', left:'right', right:'left' }[pref];
    const others = ['top','bottom','right','left'].filter(p => p !== pref && p !== opposite);
    return [pref, opposite, ...others];
  })(preferred);

  for (const p of placements){
    let left, top;
    if (p === 'top'){
      left = refRect.left + (refRect.width - popRect.width)/2;
      top = refRect.top - popRect.height - offset;
    } else if (p === 'bottom'){
      left = refRect.left + (refRect.width - popRect.width)/2;
      top = refRect.bottom + offset;
    } else if (p === 'left'){
      left = refRect.left - popRect.width - offset;
      top = refRect.top + (refRect.height - popRect.height)/2;
    } else { // right
      left = refRect.right + offset;
      top = refRect.top + (refRect.height - popRect.height)/2;
    }

    left = clamp(left, pads, Math.max(vw - popRect.width - pads, pads));
    top  = clamp(top, pads, Math.max(vh - popRect.height - pads, pads));

    if (left >= 0 && top >= 0 && left + popRect.width <= vw && top + popRect.height <= vh) {
      return { left, top, placement: p };
    }
  }

  // fallback center
  return { left: Math.max((vw - popRect.width)/2, 6), top: Math.max((vh - popRect.height)/2, 6), placement: placements[0] };
}

/* set --arrow-left / --arrow-top CSS variables using absolute coords */
function setArrowPosition(tooltipEl, refRect, popRect, placement){
  tooltipEl.style.removeProperty('--arrow-left');
  tooltipEl.style.removeProperty('--arrow-top');
  tooltipEl.style.removeProperty('--arrow-bottom');
  tooltipEl.style.removeProperty('--arrow-right');

  if (placement === 'top' || placement === 'bottom'){
    let leftOffset = (refRect.left + refRect.width/2) - popRect.left;
    leftOffset = clamp(leftOffset - 5, 8, popRect.width - 18);
    tooltipEl.style.setProperty('--arrow-left', leftOffset + 'px');
    if (placement === 'top') { tooltipEl.style.setProperty('--arrow-bottom','-5px'); tooltipEl.style.setProperty('--arrow-top','auto'); }
    else { tooltipEl.style.setProperty('--arrow-top','-5px'); tooltipEl.style.setProperty('--arrow-bottom','auto'); }
  } else {
    let topOffset = (refRect.top + refRect.height/2) - popRect.top;
    topOffset = clamp(topOffset - 5, 8, popRect.height - 18);
    tooltipEl.style.setProperty('--arrow-top', topOffset + 'px');
    if (placement === 'left'){ tooltipEl.style.setProperty('--arrow-right','-5px'); tooltipEl.style.setProperty('--arrow-left','auto'); }
    else { tooltipEl.style.setProperty('--arrow-left','-5px'); tooltipEl.style.setProperty('--arrow-right','auto'); }
  }
}

/* follow cursor mouse handler */
function followMouse(e){
  const node = ensureSharedTooltip();
  if (!node || node.dataset.follow !== 'true') return;
  const offset = DEFAULT.offset;
  const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  const nx = clamp(e.clientX + offset, 8, vw - node.offsetWidth - 8);
  const ny = clamp(e.clientY + offset, 8, vh - node.offsetHeight - 8);
  node.style.left = nx + 'px';
  node.style.top  = ny + 'px';
  node.dataset.placement = 'bottom';
}

/* progress bar helper */
function startProgress(node, duration){
  let pr = node.querySelector('.progress');
  if (!pr){
    pr = document.createElement('div'); pr.className = 'progress';
    const bar = document.createElement('b'); bar.style.width='0%'; pr.appendChild(bar); node.appendChild(pr);
  }
  const bar = pr.querySelector('b');
  const start = performance.now();
  if (node._progressTimer) clearInterval(node._progressTimer);
  node._progressTimer = setInterval(()=>{
    const now = performance.now();
    const pct = clamp(((now - start)/duration)*100, 0, 100);
    bar.style.width = pct + '%';
    if (pct >= 100){ clearInterval(node._progressTimer); node._progressTimer=null; node.classList.remove('show'); }
  }, 30);
}

/* Show shared (non-interactive) tooltip */
function showSharedTooltip(target, options = {}){
  const text = options.html ? '' : (target.getAttribute('data-tooltip') || '');
  const html = options.html || target.getAttribute('data-tooltip-html') || '';
  const effect = options.effect || target.getAttribute('data-effect') || 'fade';
  const theme = options.theme || target.getAttribute('data-theme') || target.getAttribute('data-tooltip-theme') || '';
  const placementPref = options.placement || target.getAttribute('data-placement') || 'auto';
  const follow = options.follow || target.getAttribute('data-follow') === 'true';
  const delay = ('delay' in options) ? options.delay : parseInt(target.getAttribute('data-delay')||0,10);
  const duration = ('duration' in options) ? options.duration : parseInt(target.getAttribute('data-duration')||0,10);
  const showProgress = options.progress || target.getAttribute('data-progress') === 'true';

  if (follow){
    const node = ensureSharedTooltip();
    node.className = `tooltip ${effect} show`;
    node.dataset.theme = theme || '';
    node.dataset.placement = 'bottom';
    node.innerHTML = options.html ? options.html : (target.hasAttribute('data-tooltip-html') ? sanitizeHTML(html) : (text || html));
    node.style.pointerEvents = 'none';
    node.dataset.follow = 'true';
    window.addEventListener('mousemove', followMouse);
    if (duration) startProgress(node, duration);
    return node;
  }

  // respect delay
  const timer = setTimeout(()=>{
    const node = ensureSharedTooltip();
    node.className = `tooltip ${effect} show`;
    node.dataset.theme = theme || '';
    node.dataset.placement = 'top';
    node.innerHTML = options.html ? options.html : (target.hasAttribute('data-tooltip-html') ? html : sanitizeHTML(text || html));
    node.style.pointerEvents = 'none';
    node.dataset.follow = 'false';

    node.style.left = '0px'; node.style.top = '0px';
    const refRect = target.getBoundingClientRect();
    const popRect = node.getBoundingClientRect();
    const pos = computePosition(refRect, popRect, placementPref, DEFAULT.offset);
    node.style.left = pos.left + 'px';
    node.style.top = pos.top + 'px';
    node.dataset.placement = pos.placement;
    setArrowPosition(node, refRect, node.getBoundingClientRect(), pos.placement);
    if (showProgress && duration) startProgress(node, duration);
    if (duration && !showProgress){
      setTimeout(()=> hideTooltipFor(target), duration);
    }
  }, delay || DEFAULT.delayShow);

  target._tooltipTimer = timer;
  return null;
}

/* Hide shared */
function hideSharedTooltip(target){
  if (target && target._tooltipTimer){ clearTimeout(target._tooltipTimer); target._tooltipTimer=null; }
  const node = ensureSharedTooltip();
  if (node && node.dataset.follow === 'true'){ window.removeEventListener('mousemove', followMouse); node.dataset.follow='false'; }
  if (node) node.classList.remove('show');
  if (node && node._progressTimer){ clearInterval(node._progressTimer); node._progressTimer=null; const p = node.querySelector('.progress > b'); if (p) p.style.width='0%'; }
}
function hideTooltipFor(target){ hideSharedTooltip(target); }

/* Interactive tooltip (dedicated DOM node) */
function showInteractiveTooltip(target, options = {}){
  let node = target._interactiveNode;
  if (!node){
    node = document.createElement('div');
    node.className = 'tooltip interactive';
    node.tabIndex = -1;
    document.body.appendChild(node);
    target._interactiveNode = node;
  }
  const html = options.html || target.getAttribute('data-tooltip-html') || target.getAttribute('data-tooltip') || '';
  const effect = options.effect || target.getAttribute('data-effect') || 'fade';
  const theme = options.theme || target.getAttribute('data-theme') || '';
  const placementPref = options.placement || target.getAttribute('data-placement') || 'auto';

  node.className = `tooltip interactive ${effect} show`;
  node.dataset.theme = theme || '';
  node.innerHTML = options.html ? options.html : (target.hasAttribute('data-tooltip-html') ? html : sanitizeHTML(html));

  node.style.left='0px'; node.style.top='0px';
  const refRect = target.getBoundingClientRect();
  const popRect = node.getBoundingClientRect();
  const pos = computePosition(refRect, popRect, placementPref, DEFAULT.offset);
  node.style.left = pos.left + 'px';
  node.style.top = pos.top + 'px';
  node.dataset.placement = pos.placement;
  setArrowPosition(node, refRect, node.getBoundingClientRect(), pos.placement);

  // outside click close
  if (!node._clickHandler){
    node._clickHandler = (ev) => {
      if (!node.contains(ev.target) && !target.contains(ev.target)){
        hideInteractiveTooltip(target);
      }
    };
    document.addEventListener('click', node._clickHandler);
  }

  // keyboard handling
  node._keydown = (ev) => {
    if (ev.key === 'Escape'){ hideInteractiveTooltip(target); return; }
    if (ev.key === 'Tab'){
      const focusables = Array.from(node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'));
      if (focusables.length === 0) return;
      const first = focusables[0], last = focusables[focusables.length-1];
      if (ev.shiftKey && document.activeElement === first){ ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last){ ev.preventDefault(); first.focus(); }
    }
  };
  node.addEventListener('keydown', node._keydown);

  const f = node.querySelector('input, button, [tabindex]') || node;
  f.focus();
}

function hideInteractiveTooltip(target){
  const node = target._interactiveNode;
  if (!node) return;
  node.classList.remove('show');
  if (node._clickHandler){ document.removeEventListener('click', node._clickHandler); node._clickHandler = null; }
  if (node._keydown){ node.removeEventListener('keydown', node._keydown); node._keydown=null; }
  setTimeout(()=> { if (node && node.parentNode) node.parentNode.removeChild(node); target._interactiveNode = null; }, 220);
}

/* Central handlers */
function handleShow(e){
  const target = e.currentTarget || e.target;
  if (!target) return;
  const interactive = target.getAttribute('data-interactive') === 'true';
  const sticky = target.getAttribute('data-sticky');
  const duration = parseInt(target.getAttribute('data-duration')||0,10);

  if (target.id === 'stackBtn'){ showSharedTooltip(target); setTimeout(()=> showSharedTooltip(target), 160); return; }
  if (interactive) showInteractiveTooltip(target);
  else showSharedTooltip(target);

  if (sticky === 'true'){
    target._stickyHandler = () => hideTooltipFor(target);
    target.addEventListener('click', target._stickyHandler, { once:true });
  } else if (sticky === 'once'){
    const d = duration || 3000;
    setTimeout(()=> hideTooltipFor(target), d);
  }
}

function handleHide(e){
  const target = e.currentTarget || e.target;
  if (!target) return;
  const interactive = target.getAttribute('data-interactive') === 'true';
  if (interactive) hideInteractiveTooltip(target);
  else hideSharedTooltip(target);
}

/* attach delegates to elements with data-tooltip */
function attachDelegates(){
  $$('[data-tooltip]').forEach(el => {
    el.addEventListener('mouseenter', handleShow);
    el.addEventListener('mouseleave', handleHide);
    el.addEventListener('focusin', handleShow);
    el.addEventListener('focusout', handleHide);

    el.addEventListener('click', ()=>{
      if (el.getAttribute('data-sticky') === 'true') {
        if (el._stickyActive){ hideTooltipFor(el); el._stickyActive=false; }
        else { handleShow({currentTarget:el}); el._stickyActive=true; }
      }
    });

    const duration = parseInt(el.getAttribute('data-duration')||0,10);
    if (duration && el.getAttribute('data-progress') !== 'true'){
      el.addEventListener('mouseenter', ()=>{
        if (el._durationTimer) clearTimeout(el._durationTimer);
        el._durationTimer = setTimeout(()=> hideSharedTooltip(el), duration);
      });
      el.addEventListener('mouseleave', ()=> { if (el._durationTimer) clearTimeout(el._durationTimer); });
    }
  });

  window.addEventListener('scroll', () => { const node = sharedTooltip; if (node && node.classList.contains('show')) { node.classList.remove('show'); } }, true);
  window.addEventListener('resize', () => { const node = sharedTooltip; if (node && node.classList.contains('show')) { node.classList.remove('show'); } });
}

/* init on DOM ready */
document.addEventListener('DOMContentLoaded', () => {
  attachDelegates();
  // expose debug handles
  window.__tooltipSystem = {
    showFor: (sel)=>{ const el=document.querySelector(sel); if(el) showSharedTooltip(el); },
    hideFor: (sel)=>{ const el=document.querySelector(sel); if(el) hideSharedTooltip(el); }
  };
});

/* -------- Developer API (new) --------
   TooltipAPI provides programmatic utility functions devs commonly need.
*/
window.TooltipAPI = (function(){
  const attachedMap = new Map();

  function normalizeEl(elOrSelector){
    if (!elOrSelector) return null;
    if (typeof elOrSelector === 'string') return document.querySelector(elOrSelector);
    if (elOrSelector instanceof Element) return elOrSelector;
    return null;
  }

  function show(opts = {}){
    if (opts.x != null && opts.y != null){
      const node = document.createElement('div');
      node.className = `tooltip ${opts.effect || 'fade'} show`;
      if (opts.theme) node.dataset.theme = opts.theme;
      node.style.position = 'fixed';
      node.style.left = (opts.x) + 'px';
      node.style.top = (opts.y) + 'px';
      node.innerHTML = opts.html ? opts.html : sanitizeHTML(opts.text || '');
      document.body.appendChild(node);
      if (opts.duration) setTimeout(()=> { if (node && node.parentNode) node.parentNode.removeChild(node); }, opts.duration);
      return { node, hide: ()=> { if (node && node.parentNode) node.parentNode.removeChild(node); } };
    }

    const target = normalizeEl(opts.target);
    if (!target) {
      console.warn('TooltipAPI.show: no valid target or coords provided');
      return null;
    }

    if (opts.interactive) {
      showInteractiveTooltip(target, { html: opts.html || opts.text, effect: opts.effect, theme: opts.theme, placement: opts.placement });
      const node = target._interactiveNode;
      if (opts.duration) setTimeout(()=> hideInteractiveTooltip(target), opts.duration);
      return { node, hide: ()=> hideInteractiveTooltip(target) };
    } else {
      showSharedTooltip(target, { html: opts.html, effect: opts.effect, theme: opts.theme, placement: opts.placement, follow: opts.follow, delay: opts.delay, duration: opts.duration, progress: opts.progress });
      const node = ensureSharedTooltip();
      if (opts.duration) setTimeout(()=> hideSharedTooltip(target), opts.duration);
      return { node, hide: ()=> hideSharedTooltip(target) };
    }
  }

  function hide(handleOrEl){
    if (!handleOrEl) return;
    if (handleOrEl.hide && typeof handleOrEl.hide === 'function') {
      handleOrEl.hide();
      return;
    }
    const el = normalizeEl(handleOrEl);
    if (el && el._interactiveNode) hideInteractiveTooltip(el);
    else if (el) hideSharedTooltip(el);
  }

  function attach(selector, options = {}){
    if (!selector) return;
    const handler = (ev) => {
      const el = ev.currentTarget;
      const useHtml = options.dataTooltipFromAttr ? (el.hasAttribute('data-tooltip-html') ? el.getAttribute('data-tooltip-html') : null) : options.html;
      const showOpts = Object.assign({}, {
        target: el,
        html: useHtml,
        effect: options.effect || el.getAttribute('data-effect'),
        theme: options.theme || el.getAttribute('data-theme'),
        placement: options.placement || el.getAttribute('data-placement'),
        follow: options.follow || el.getAttribute('data-follow') === 'true',
        delay: options.delay
      });
      show(showOpts);
    };

    const elements = Array.from(document.querySelectorAll(selector));
    elements.forEach(el => {
      el.addEventListener('mouseenter', handler);
      el.addEventListener('focusin', handler);
    });
    attachedMap.set(selector, { handler, options });
    return true;
  }

  function detach(selector){
    const entry = attachedMap.get(selector);
    if (!entry) {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach(n => {
        n.removeEventListener('mouseenter', handleShow);
        n.removeEventListener('focusin', handleShow);
      });
      return;
    }
    const { handler } = entry;
    const nodes = document.querySelectorAll(selector);
    nodes.forEach(n => {
      n.removeEventListener('mouseenter', handler);
      n.removeEventListener('focusin', handler);
    });
    attachedMap.delete(selector);
  }

  function copyToClipboard(elementOrSelector, { text = '', duration = 1400, effect = 'pop', theme = 'success' } = {}){
    const el = normalizeEl(elementOrSelector);
    if (!el) return;
    show({ target: el, text, effect, theme, placement: 'top', duration });
  }

  function showShortcut(elementOrSelector, combo = 'Ctrl+K', opts = {}){
    const el = normalizeEl(elementOrSelector);
    if (!el) return;
    const html = `<span class="tiny">${sanitizeHTML(combo)}</span>`;
    return show({ target: el, html, effect: opts.effect || 'pop', theme: opts.theme || '', placement: opts.placement || 'top', duration: opts.duration || 2200, interactive: false });
  }

  function showValidation(elementOrSelector, message = 'Invalid', opts = {}){
    const el = normalizeEl(elementOrSelector);
    if (!el) return;
    const html = sanitizeHTML(message);
    return show({ target: el, html, effect: opts.effect || 'shake', theme: opts.theme || 'error', placement: opts.placement || 'right', duration: opts.duration || 2400 });
  }

  function showColorSwatch(elementOrSelector, color = '#FF0000', opts = {}){
    const el = normalizeEl(elementOrSelector);
    if (!el) return;
    const safeColor = sanitizeHTML(color);
    const html = `<span class="swatch" style="background:${safeColor}"></span><span class="tiny">${safeColor}</span>`;
    return show({ target: el, html, effect: opts.effect || 'pop', theme: opts.theme || '', placement: opts.placement || 'right', duration: opts.duration || 2400 });
  }

  function showAt({ x, y, html = '', text = '', effect = 'fade', theme = '', placement = 'auto', duration = 2000 } = {}){
    if (x == null || y == null) { console.warn('TooltipAPI.showAt requires x and y'); return; }
    const node = document.createElement('div');
    node.className = `tooltip ${effect} show`;
    if (theme) node.dataset.theme = theme;
    node.style.position = 'fixed';
    node.style.left = (x) + 'px';
    node.style.top = (y) + 'px';
    node.innerHTML = html ? html : sanitizeHTML(text);
    document.body.appendChild(node);
    if (duration) setTimeout(()=> { if (node && node.parentNode) node.parentNode.removeChild(node); }, duration);
    return { node, hide: ()=> { if (node && node.parentNode) node.parentNode.removeChild(node); } };
  }

  return {
    show,
    hide,
    attach,
    detach,
    copyToClipboard,
    showShortcut,
    showValidation,
    showColorSwatch,
    showAt
  };
})();

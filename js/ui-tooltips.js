document.addEventListener("DOMContentLoaded", () => {
  const tooltip = new TooltipSystem();
  const popover = new PopoverSystem();

  // Effect viewer control
  const effectSelect = document.getElementById("effectSelect");
  const themeSelect = document.getElementById("themeSelect");
  const placementSelect = document.getElementById("placementSelect");
  const tooltipBtn = document.getElementById("tooltipBtn");
  const popoverBtn = document.getElementById("popoverBtn");

  // Update tooltip attributes dynamically
  function updateAttributes() {
    tooltipBtn.dataset.effect = effectSelect.value;
    tooltipBtn.dataset.theme = themeSelect.value;
    tooltipBtn.dataset.placement = placementSelect.value;
  }

  [effectSelect, themeSelect, placementSelect].forEach((el) =>
    el.addEventListener("change", updateAttributes)
  );
  updateAttributes();

  popoverBtn.addEventListener("click", (e) => {
    popover.toggle(popoverBtn, `
      <strong>Popover Preview</strong><br/>
      Current effect: <em>${effectSelect.value}</em><br/>
      Theme: <em>${themeSelect.value}</em><br/>
      Placement: <em>${placementSelect.value}</em>
    `, {
      effect: effectSelect.value,
      placement: placementSelect.value
    });
  });
});

class TooltipSystem {
  constructor() {
    this.tooltip = null;
    document.body.addEventListener("mouseover", (e) => {
      const target = e.target.closest("[data-tooltip]");
      if (!target) return;
      this.show(target);
    });
    document.body.addEventListener("mouseout", (e) => {
      const target = e.target.closest("[data-tooltip]");
      if (!target) return;
      this.hide();
    });
  }

  show(target) {
    const text = target.dataset.tooltip;
    if (!text) return;
    if (!this.tooltip) {
      this.tooltip = document.createElement("div");
      this.tooltip.className = "tooltip";
      document.body.appendChild(this.tooltip);
    }

    this.tooltip.textContent = text;

    const theme = target.dataset.theme || "dark";
    const effect = target.dataset.effect || "fade";
    const placement = target.dataset.placement || "top";

    this.tooltip.dataset.theme = theme;
    this.tooltip.dataset.placement = placement;
    this.tooltip.className = `tooltip ${effect} show`;

    this.position(target, placement);
  }

  hide() {
    if (this.tooltip) this.tooltip.classList.remove("show");
  }

  position(target, placement) {
    const rect = target.getBoundingClientRect();
    const tip = this.tooltip.getBoundingClientRect();
    const offset = 10;
    let top, left;

    switch (placement) {
      case "bottom":
        top = rect.bottom + offset;
        left = rect.left + (rect.width - tip.width) / 2;
        break;
      case "left":
        top = rect.top + (rect.height - tip.height) / 2;
        left = rect.left - tip.width - offset;
        break;
      case "right":
        top = rect.top + (rect.height - tip.height) / 2;
        left = rect.right + offset;
        break;
      default:
        top = rect.top - tip.height - offset;
        left = rect.left + (rect.width - tip.width) / 2;
    }

    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }
}

class PopoverSystem {
  constructor() {
    this.popover = null;
    this.activeTrigger = null;
    document.addEventListener("click", (e) => {
      if (this.popover && !this.popover.contains(e.target) && this.activeTrigger !== e.target) {
        this.hide();
      }
    });
  }

  toggle(trigger, content, opts = {}) {
    if (this.activeTrigger === trigger) this.hide();
    else this.show(trigger, content, opts);
  }

  show(trigger, content, opts) {
    this.hide();
    this.popover = document.createElement("div");
    this.popover.className = `popover ${opts.effect || "fade"} show`;
    this.popover.innerHTML = content;
    document.body.appendChild(this.popover);

    this.activeTrigger = trigger;
    this.position(trigger, opts.placement || "bottom");
  }

  hide() {
    if (this.popover) this.popover.remove();
    this.popover = null;
    this.activeTrigger = null;
  }

  position(trigger, placement) {
    const rect = trigger.getBoundingClientRect();
    const pop = this.popover.getBoundingClientRect();
    const offset = 12;
    let top, left;

    switch (placement) {
      case "top":
        top = rect.top - pop.height - offset;
        left = rect.left + (rect.width - pop.width) / 2;
        break;
      case "left":
        top = rect.top + (rect.height - pop.height) / 2;
        left = rect.left - pop.width - offset;
        break;
      case "right":
        top = rect.top + (rect.height - pop.height) / 2;
        left = rect.right + offset;
        break;
      default:
        top = rect.bottom + offset;
        left = rect.left + (rect.width - pop.width) / 2;
    }

    this.popover.style.top = `${top}px`;
    this.popover.style.left = `${left}px`;
  }
}

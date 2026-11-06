// @ts-check
// Runs inside the sandboxed preview; standalone exports omit this bridge.
(() => {
  /** @type {Element | null} */
  let active = null;
  /** @type {{x: number, y: number} | null} */
  let pointer = null;
  let pending = 0;
  const probe = document.createElement("span");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;contain:strict";
  document.body.append(probe);

  /** @param {string} color */
  function alpha(color) {
    const match =
      color.match(/\/\s*([\d.]+)(%?)\s*\)$/) ??
      color.match(/^rgba\(.*?,\s*([\d.]+)\s*\)$/);
    return color === "transparent"
      ? 0
      : match
        ? Number(match[1]) / (match[2] ? 100 : 1)
        : 1;
  }

  /** @param {Element} element @param {string} token @param {string} actual @param {string | undefined} opacity */
  function matchesColor(element, token, actual, opacity) {
    let value = getComputedStyle(element).getPropertyValue(token).trim();
    if (!value || !CSS.supports("color", value)) return false;
    if (opacity) {
      if (!/^\d+(?:\.\d+)?$/.test(opacity)) return false;
      value = `color-mix(in oklab, ${value} ${opacity}%, transparent)`;
    }
    probe.style.setProperty("color", value, "important");
    return getComputedStyle(probe).color === actual;
  }

  /** @param {Element} element @param {string} prefix @param {string} actual */
  function utilityToken(element, prefix, actual) {
    const utilities = [...element.classList].sort(
      (a, b) => b.split(":").length - a.split(":").length,
    );
    for (const utility of utilities) {
      const parts = utility.split(":");
      const base = parts.pop() ?? "";
      if (!base.startsWith(`${prefix}-`)) continue;
      if (
        !parts.every((part) =>
          part === "dark"
            ? document.documentElement.classList.contains("dark")
            : ["hover", "focus", "focus-visible", "disabled"].includes(part) &&
              element.matches(`:${part}`),
        )
      )
        continue;
      const [name, opacity] = base.slice(prefix.length + 1).split("/");
      if (!name || !/^[\w-]+$/.test(name)) continue;
      const token = `--color-${name}`;
      if (matchesColor(element, token, actual, opacity)) return token;
    }
    return null;
  }

  /** @param {Element} element */
  function tokensFor(element) {
    /** @type {Set<string>} */
    const tokens = new Set();
    /** @type {Element | null} */
    let surface = element;
    for (; surface; surface = surface.parentElement) {
      const style = getComputedStyle(surface);
      if (alpha(style.backgroundColor) > 0) {
        const token = utilityToken(surface, "bg", style.backgroundColor);
        if (token) tokens.add(token);
        if (alpha(style.backgroundColor) === 1 && Number(style.opacity) === 1)
          break;
      }
    }
    const text =
      [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      ) ||
      element instanceof HTMLTextAreaElement ||
      (element instanceof HTMLInputElement &&
        !["checkbox", "radio"].includes(element.type));
    const style = getComputedStyle(element);
    if (text) {
      /** @type {Element | null} */
      let owner = element;
      for (; owner; owner = owner.parentElement) {
        const token = utilityToken(owner, "text", style.color);
        if (token) {
          tokens.add(token);
          break;
        }
      }
    }
    for (const side of ["top", "right", "bottom", "left"]) {
      if (
        parseFloat(style.getPropertyValue(`border-${side}-width`)) <= 0 ||
        style.getPropertyValue(`border-${side}-style`) === "none"
      )
        continue;
      const color = style.getPropertyValue(`border-${side}-color`);
      const token = utilityToken(element, "border", color);
      if (token) tokens.add(token);
      else if (matchesColor(element, "--color-border", color, undefined))
        tokens.add("--color-border");
    }
    if (parseFloat(style.outlineWidth) > 0 && style.outlineStyle !== "none") {
      const token = utilityToken(element, "outline", style.outlineColor);
      if (token) tokens.add(token);
    }
    const accent = utilityToken(element, "accent", style.accentColor);
    if (accent) tokens.add(accent);
    return [...tokens];
  }

  function inspect() {
    pending = 0;
    if (pointer) active = document.elementFromPoint(pointer.x, pointer.y);
    if (!active || !active.closest("main")) {
      parent.postMessage(
        { type: "preview-hover", rect: null, tokens: [] },
        "*",
      );
      return;
    }
    const rect = active.getBoundingClientRect();
    parent.postMessage(
      {
        type: "preview-hover",
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        tokens: tokensFor(active),
      },
      "*",
    );
  }
  function schedule() {
    if (!pending) pending = requestAnimationFrame(inspect);
  }
  function clear() {
    active = null;
    pointer = null;
    schedule();
  }
  document.addEventListener("pointermove", (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (event.target instanceof Element && event.target !== active) {
      active = event.target;
      schedule();
    }
  });
  document.addEventListener("pointerover", (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    if (event.target instanceof Element) active = event.target;
    schedule();
  });
  document.addEventListener("pointerout", (event) => {
    if (!event.relatedTarget) clear();
  });
  document.addEventListener("focusin", (event) => {
    pointer = null;
    active = event.target instanceof Element ? event.target : null;
    schedule();
  });
  document.addEventListener("focusout", (event) => {
    if (!event.relatedTarget) clear();
  });
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      !(event.ctrlKey || event.metaKey) ||
      event.altKey
    )
      return;
    if (
      event.target instanceof Element &&
      event.target.closest(
        'textarea,input:not([type="range"]):not([type="checkbox"]):not([type="radio"]),[contenteditable]:not([contenteditable="false"])',
      )
    )
      return;
    const key = event.key.toLowerCase();
    const action =
      key === "z"
        ? event.shiftKey
          ? "redo"
          : "undo"
        : key === "y" && !event.shiftKey
          ? "redo"
          : null;
    if (!action) return;
    event.preventDefault();
    parent.postMessage({ type: "preview-history", action }, "*");
  });
  window.addEventListener("message", (event) => {
    if (
      event.source !== parent ||
      event.data?.type !== "preview-theme" ||
      typeof event.data.css !== "string"
    )
      return;
    const style = document.getElementById("preview-theme");
    if (style && style.textContent !== event.data.css)
      style.textContent = event.data.css;
    schedule();
  });
})();

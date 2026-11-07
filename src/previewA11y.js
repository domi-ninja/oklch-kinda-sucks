// @ts-check
// Diagnostics use an isolated shadow root and never enter exported apps.
window.addEventListener(
  "load",
  () => {
    const host = document.createElement("div");
    host.id = "preview-a11y-overlay";
    host.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
    :host { font: 13px/1.4 sans-serif; color-scheme:light; }
    .mark { position:absolute; outline:2px solid #b91c1c; outline-offset:2px; pointer-events:none; }
    .mark.review { outline-color:#a16207; }
    button { position:absolute; right:0; top:0; min-width:24px; min-height:24px; padding:2px 5px; background:#b91c1c; color:white; border:1px solid white; border-radius:3px; font:inherit; pointer-events:auto; cursor:pointer; }
    .review button {background:#854d0e}
    button:focus-visible {outline:3px solid #111;outline-offset:2px}
    .tip {display:none;position:fixed;max-width:min(320px,calc(100vw - 16px));padding:8px;background:#fff;color:#111;border:2px solid #b91c1c;border-radius:4px;white-space:pre-line;z-index:2;pointer-events:none}
    .summary {position:fixed;bottom:4px;left:4px;background:#fff;color:#111;border:1px solid #777;border-radius:3px;padding:2px 6px;pointer-events:none}
  </style><div id="marks"></div><div class="tip" id="tip"></div><span class="summary" aria-live="polite">Checking accessibility…</span>`;
    document.body.append(host);
    const axe = /** @type {typeof import("axe-core")} */ (
      Reflect.get(window, "axe")
    );
    /** @param {Document | ShadowRoot} root @param {string} selector */
    function element(root, selector) {
      const found = root.querySelector(selector);
      if (!(found instanceof HTMLElement))
        throw new Error(`Missing ${selector}`);
      return found;
    }
    const main = element(document, "main");
    const marks = element(shadow, "#marks");
    const tip = element(shadow, "#tip");
    const summary = element(shadow, ".summary");
    /** @type {{element: Element; message: string; review: boolean}[]} */
    let findings = [];
    let revision = 0;
    let timer = 0;
    let running = false;
    let queued = false;
    let layout = 0;
    function paint() {
      layout = 0;
      marks.replaceChildren();
      tip.style.display = "none";
      for (const [index, issue] of findings.entries()) {
        const rect = issue.element.getBoundingClientRect();
        if (
          !issue.element.isConnected ||
          rect.bottom <= 0 ||
          rect.top >= innerHeight ||
          rect.width === 0 ||
          rect.height === 0
        )
          continue;
        const mark = document.createElement("div");
        mark.className = `mark${issue.review ? " review" : ""}`;
        mark.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px`;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(index + 1);
        button.setAttribute("aria-label", issue.message);
        button.dataset.a11yIssue = issue.review ? "review" : "failure";
        const show = () => {
          tip.textContent = issue.message;
          tip.style.display = "block";
          tip.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 328))}px`;
          tip.style.top = `${Math.max(8, Math.min(rect.bottom + 8, innerHeight - tip.offsetHeight - 8))}px`;
        };
        button.onpointerenter = show;
        button.onfocus = show;
        button.onclick = show;
        button.onpointerleave = () => {
          tip.style.display = "none";
        };
        button.onblur = () => {
          tip.style.display = "none";
        };
        button.onkeydown = (event) => {
          if (event.key === "Escape") tip.style.display = "none";
        };
        mark.append(button);
        marks.append(mark);
      }
    }
    function reposition() {
      if (!layout) layout = requestAnimationFrame(paint);
    }
    async function audit() {
      if (running) {
        queued = true;
        return;
      }
      running = true;
      const current = revision;
      try {
        const result = await axe.run(
          { include: [main], exclude: [host] },
          {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
            resultTypes: ["violations", "incomplete"],
          },
        );
        if (current !== revision) {
          queued = true;
          return;
        }
        findings = [];
        /** @param {import("axe-core").Result[]} issues @param {boolean} review */
        function collect(issues, review) {
          for (const issue of issues)
            for (const node of issue.nodes) {
              const selector = node.target[0];
              if (typeof selector !== "string") continue;
              const element = document.querySelector(selector);
              if (element)
                findings.push({
                  element,
                  review,
                  message: `${review ? "Needs review: " : ""}${issue.help}\n${node.failureSummary ?? issue.description}`,
                });
            }
        }
        collect(result.violations, false);
        collect(result.incomplete, true);
        const failures = findings.filter((issue) => !issue.review).length;
        const reviews = findings.length - failures;
        summary.textContent = `A11y: ${failures} ${failures === 1 ? "issue" : "issues"}${reviews ? `, ${reviews} to review` : ""}`;
        host.dataset.a11yFailures = String(failures);
        host.dataset.a11yReviews = String(reviews);
        paint();
      } catch {
        summary.textContent = "Accessibility check unavailable";
      } finally {
        running = false;
        if (queued) {
          queued = false;
          schedule();
        }
      }
    }
    function schedule() {
      const container = document.querySelector("dialog[open]") ?? document.body;
      if (host.parentElement !== container) container.append(host);
      revision++;
      clearTimeout(timer);
      timer = window.setTimeout(audit, 200);
    }
    window.addEventListener("message", (event) => {
      if (event.source === parent && event.data?.type === "preview-theme")
        schedule();
    });
    new MutationObserver(schedule).observe(main, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "open", "aria-invalid"],
    });
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", () => {
      reposition();
      schedule();
    });
    document.fonts.ready.then(schedule);
    schedule();
  },
  { once: true },
);

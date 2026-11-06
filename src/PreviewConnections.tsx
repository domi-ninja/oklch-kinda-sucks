import { useEffect, useState } from "react";
import { z } from "zod";

const hoverMessage = z.object({
  type: z.literal("preview-hover"),
  rect: z
    .object({
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().finite().nonnegative(),
      height: z.number().finite().nonnegative(),
    })
    .nullable(),
  tokens: z.array(z.string().regex(/^--color-[\w-]+$/)).max(16),
});
type Hover = { frame: HTMLIFrameElement; data: z.infer<typeof hoverMessage> };
type Point = { x: number; y: number };
type Geometry = {
  rect: { x: number; y: number; width: number; height: number };
  lines: { from: Point; to: Point; token: string }[];
};

// Isolate hover rendering from the editor and its color-rendering workers.
export function PreviewConnections() {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  useEffect(function connectHoveredPreviewColors() {
    let active: Hover | null = null;
    let pending = 0;
    let highlighted: HTMLElement[] = [];
    const clearHighlights = () => {
      highlighted.forEach((button) =>
        button.removeAttribute("data-preview-highlight"),
      );
      highlighted = [];
    };
    function targets(hover: Hover) {
      const buttons = [
        ...document.querySelectorAll<HTMLElement>("[data-theme-token]"),
      ];
      return hover.data.tokens.flatMap((token) => {
        const name = token.slice(2);
        const dark =
          hover.frame.dataset.previewMode === "dark"
            ? buttons.find(
                (button) => button.dataset.themeToken === `dark / ${name}`,
              )
            : undefined;
        const button =
          dark ?? buttons.find((button) => button.dataset.themeToken === name);
        return button ? [{ button, token }] : [];
      });
    }
    function measure() {
      pending = 0;
      clearHighlights();
      if (!active?.data.rect || !active.frame.isConnected) {
        setGeometry(null);
        return;
      }
      const matches = targets(active);
      highlighted = matches.map(({ button }) => button);
      highlighted.forEach((button) =>
        button.setAttribute("data-preview-highlight", ""),
      );
      const bounds = active.frame.getBoundingClientRect();
      const origin = {
        x: bounds.x + active.frame.clientLeft,
        y: bounds.y + active.frame.clientTop,
      };
      const source = active.data.rect;
      const left = origin.x + Math.max(0, source.x);
      const top = origin.y + Math.max(0, source.y);
      const right =
        origin.x + Math.min(active.frame.clientWidth, source.x + source.width);
      const bottom =
        origin.y +
        Math.min(active.frame.clientHeight, source.y + source.height);
      if (right <= left || bottom <= top || bottom < 0 || top > innerHeight) {
        setGeometry(null);
        return;
      }
      const rect = {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
      const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
      const lines = matches.flatMap(({ button, token }) => {
        const swatch = button
          .querySelector(".token-swatch")
          ?.getBoundingClientRect();
        if (!swatch) return [];
        const to = {
          x: swatch.x + swatch.width / 2,
          y: swatch.y + swatch.height / 2,
        };
        const from =
          Math.abs(to.x - center.x) > Math.abs(to.y - center.y)
            ? { x: to.x < center.x ? left : right, y: center.y }
            : { x: center.x, y: to.y < center.y ? top : bottom };
        return [{ from, to, token }];
      });
      setGeometry(lines.length ? { rect, lines } : null);
    }
    function schedule() {
      if (!pending) pending = requestAnimationFrame(measure);
    }
    function receive(event: MessageEvent<unknown>) {
      const frame = [
        ...document.querySelectorAll<HTMLIFrameElement>(
          "iframe[data-preview-mode]",
        ),
      ].find((frame) => frame.contentWindow === event.source);
      if (!frame) return;
      const message = hoverMessage.safeParse(event.data);
      if (!message.success) return;
      if (!message.data.rect && active?.frame !== frame) return;
      const changed =
        !active ||
        active.frame !== frame ||
        active.data.tokens.join(",") !== message.data.tokens.join(",");
      active = message.data.rect ? { frame, data: message.data } : null;
      if (active && changed && matchMedia("(min-width: 1101px)").matches)
        targets(active).forEach(({ button }) =>
          button.scrollIntoView({ block: "nearest", inline: "nearest" }),
        );
      schedule();
    }
    window.addEventListener("message", receive);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    const column = document.querySelector(".theme-column");
    if (column) observer.observe(column);
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      cancelAnimationFrame(pending);
      clearHighlights();
    };
  }, []);

  if (!geometry) return null;
  return (
    <svg className="preview-connections" aria-hidden="true">
      <rect {...geometry.rect} fill="none" className="preview-outline-back" />
      <rect {...geometry.rect} fill="none" className="preview-outline" />
      {geometry.lines.map(({ from, to, token }) => (
        <g key={token} data-connection-token={token}>
          <path
            d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
            className="preview-outline-back"
          />
          <path
            d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
            className="preview-outline"
          />
          <circle cx={to.x} cy={to.y} r="4" fill="#f59e0b" stroke="#202020" />
        </g>
      ))}
    </svg>
  );
}

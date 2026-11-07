import { useLayoutEffect, useRef, useState } from "react";
import type { ThemeMode, ThemePalette } from "./paletteHarmonizer";
import { cssColor } from "./color";
import { themeInk } from "./paletteHarmonizer";
import { Button } from "./components/ui/button";

export function ThemeTokenSlots({
  mode,
  count,
  picks,
  onMove,
  onPreview,
}: {
  mode: ThemeMode;
  count: number;
  picks: ThemePalette["picks"];
  onMove: (role: string, position: number) => void;
  onPreview: (role: string, position: number | null) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const originalPicks = useRef(picks);
  const focusRole = useRef<{ role: string; position: number } | null>(null);
  useLayoutEffect(
    function restoreMovedTokenFocus() {
      const target = focusRole.current;
      if (
        !target ||
        !picks.some(
          (pick) =>
            pick.role === target.role && pick.position === target.position,
        )
      )
        return;
      const button = Array.from(
        row.current?.querySelectorAll("button") ?? [],
      ).find(
        (button) =>
          button.getAttribute("aria-label") === `${mode} ${target.role}`,
      );
      button?.focus({ preventScroll: true });
      focusRole.current = null;
    },
    [picks, mode],
  );
  const [drag, setDrag] = useState<{ role: string; slot: number } | null>(null);
  const slotOf = (position: number) => Math.round(position * (count - 1));
  const free = (slot: number, role: string) =>
    slot >= 0 &&
    slot < count &&
    !(drag ? originalPicks.current : picks).some(
      (pick) => pick.role !== role && slotOf(pick.position) === slot,
    );
  const target = (x: number, y: number) => {
    const visible = row
      .current!.closest(".palette-scale-scroll")!
      .getBoundingClientRect();
    if (
      x < visible.left ||
      x > visible.right ||
      y < visible.top ||
      y > visible.bottom
    )
      return -1;
    const bounds = row.current!.getBoundingClientRect();
    if (
      y < bounds.top ||
      y > bounds.bottom ||
      x < bounds.left ||
      x > bounds.right
    )
      return -1;
    return Math.min(
      count - 1,
      Math.floor(((x - bounds.left) / bounds.width) * count),
    );
  };
  return (
    <div
      ref={row}
      className="theme-token-slots"
      aria-label={`${mode} token positions`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: count }, (_, slot) => (
        <div
          key={slot}
          data-token-slot={slot}
          className={`theme-token-slot${drag && free(slot, drag.role) && drag.slot === slot ? " drop-target" : ""}`}
        >
          {drag &&
            drag.slot === slot &&
            slotOf(
              originalPicks.current.find((pick) => pick.role === drag.role)!
                .position,
            ) !== slot &&
            free(slot, drag.role) && (
              <span
                aria-hidden="true"
                className="theme-token-ghost"
                style={{
                  background: cssColor(
                    picks.find((pick) => pick.role === drag.role)!.color,
                  ),
                  color:
                    themeInk(
                      picks.find((pick) => pick.role === drag.role)!.color,
                    ).l === 0
                      ? "#000"
                      : "#fff",
                }}
              >
                {drag.role[0].toUpperCase() + drag.role.slice(1)}
              </span>
            )}
          {(drag ? originalPicks.current : picks)
            .filter((pick) => slotOf(pick.position) === slot)
            .map((pick) => (
              <Button
                key={pick.role}
                type="button"
                variant="outline"
                className="theme-token-handle"
                style={{
                  background: cssColor(pick.color),
                  color: themeInk(pick.color).l === 0 ? "#000" : "#fff",
                }}
                aria-label={`${mode} ${pick.role}`}
                title={`${pick.role}: ${cssColor(pick.color)}`}
                onPointerDown={(event) => {
                  if (event.button !== 0) return;
                  originalPicks.current = picks;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDrag({ role: pick.role, slot });
                }}
                onPointerMove={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId))
                    return;
                  const scroll = row.current?.closest(".palette-scale-scroll");
                  if (scroll) {
                    const bounds = scroll.getBoundingClientRect();
                    scroll.scrollLeft +=
                      event.clientX > bounds.right - 24
                        ? 12
                        : event.clientX < bounds.left + 24
                          ? -12
                          : 0;
                  }
                  const next = target(event.clientX, event.clientY);
                  setDrag({ role: pick.role, slot: next });
                  onPreview(
                    pick.role,
                    free(next, pick.role) && next !== slot
                      ? next / (count - 1)
                      : null,
                  );
                }}
                onPointerUp={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId))
                    return;
                  const next = target(event.clientX, event.clientY);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  setDrag(null);
                  onPreview(pick.role, null);
                  if (next !== slot && free(next, pick.role))
                    onMove(pick.role, next / (count - 1));
                }}
                onPointerCancel={() => {
                  setDrag(null);
                  onPreview(pick.role, null);
                }}
                onLostPointerCapture={() => {
                  setDrag(null);
                  onPreview(pick.role, null);
                }}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const direction =
                    event.key === "ArrowLeft" || event.key === "End" ? -1 : 1;
                  let next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? count - 1
                        : slot + direction;
                  while (next >= 0 && next < count && !free(next, pick.role))
                    next += direction;
                  if (free(next, pick.role) && next !== slot) {
                    focusRole.current = {
                      role: pick.role,
                      position: next / (count - 1),
                    };
                    onMove(pick.role, next / (count - 1));
                  }
                }}
              >
                {pick.role[0].toUpperCase() + pick.role.slice(1)}
              </Button>
            ))}
        </div>
      ))}
    </div>
  );
}

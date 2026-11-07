import type { Workspace } from "./workspaceSchema";
import type { Color } from "./color";

const historyLimit = 100;
export type WorkspaceChange = (previous: Workspace) => Workspace;
export type WorkspaceHistory = {
  present: Workspace;
  past: Workspace[];
  future: Workspace[];
  group: object | null;
};
export type HistoryAction =
  | { type: "change"; change: WorkspaceChange; group: object; record: boolean }
  | { type: "undo" | "redo" };

export function sameColor(a: Color, b: Color) {
  return a === b || (a.l === b.l && a.c === b.c && a.h === b.h && a.a === b.a);
}

function sameFields<T extends object>(a: T | undefined, b: T | undefined) {
  if (a === b) return true;
  if (!a || !b) return false;
  const keys = Object.keys(a) as (keyof T)[];
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key] === b[key])
  );
}

function sameItems<T extends object>(a: T[], b: T[]) {
  return (
    a === b ||
    (a.length === b.length &&
      a.every((item, index) => sameFields(item, b[index])))
  );
}

function isEdit(a: Workspace, b: Workspace) {
  const harmonizerChanged =
    a.harmonizer !== b.harmonizer &&
    (!a.harmonizer ||
      !b.harmonizer ||
      a.harmonizer.gamut !== b.harmonizer.gamut ||
      a.harmonizer.chromaMode !== b.harmonizer.chromaMode ||
      a.harmonizer.darkBackground !== b.harmonizer.darkBackground ||
      a.harmonizer.lightBackground !== b.harmonizer.lightBackground ||
      a.harmonizer.darkColumns !== b.harmonizer.darkColumns ||
      a.harmonizer.selectedRow !== b.harmonizer.selectedRow ||
      !sameItems(a.harmonizer.rows, b.harmonizer.rows) ||
      !sameItems(a.harmonizer.levels, b.harmonizer.levels));
  const paletteChanged =
    a.palette !== b.palette &&
    (!a.palette ||
      !b.palette ||
      !sameColor(a.palette.end, b.palette.end) ||
      !sameFields(a.palette.middle, b.palette.middle) ||
      a.palette.mode !== b.palette.mode ||
      a.palette.subdivisions !== b.palette.subdivisions);
  return (
    a.source !== b.source ||
    harmonizerChanged ||
    a.active !== b.active ||
    !sameColor(a.color, b.color) ||
    paletteChanged ||
    !sameItems(a.pickers, b.pickers) ||
    !sameItems(a.saved, b.saved)
  );
}

export function createHistory(present: Workspace): WorkspaceHistory {
  return { present, past: [], future: [], group: null };
}

export function workspaceHistory(
  history: WorkspaceHistory,
  action: HistoryAction,
): WorkspaceHistory {
  if (action.type === "change") {
    const present = action.change(history.present);
    if (present === history.present) return history;
    if (!action.record || !isEdit(history.present, present))
      return { ...history, present };
    const continuing = history.group === action.group;
    const baseline = history.past.at(-1);
    const cancelled = continuing && baseline && !isEdit(baseline, present);
    return {
      present,
      past: cancelled
        ? history.past.slice(0, -1)
        : continuing
          ? history.past
          : [...history.past, history.present].slice(-historyLimit),
      future: [],
      group: cancelled ? null : action.group,
    };
  }
  const stack = action.type === "undo" ? history.past : history.future;
  const restored = stack.at(-1);
  if (!restored) return history;
  // Undo content and layout edits without moving the user away from their current view.
  const present = {
    ...restored,
    tab: history.present.tab,
    width: history.present.width,
  };
  return action.type === "undo"
    ? {
        present,
        past: history.past.slice(0, -1),
        future: [...history.future, history.present],
        group: null,
      }
    : {
        present,
        past: [...history.past, history.present],
        future: history.future.slice(0, -1),
        group: null,
      };
}

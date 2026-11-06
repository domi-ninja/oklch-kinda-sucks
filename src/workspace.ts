import { useEffect, useLayoutEffect } from "react";
import { useWorkspaceHistory } from "./useWorkspaceHistory";
import { sameColor, type WorkspaceChange } from "./workspaceHistory";
import { normalizePresets } from "./presets";
export {
  pickerModes,
  type PickerMode,
  type Workspace,
} from "./workspaceSchema";
import {
  workspaceSchema,
  colorSchema,
  pickerModes,
  type Workspace,
  type PresetShare,
} from "./workspaceSchema";
import { round, type Color } from "./color";
import { clampColor } from "./colorBounds";

export const workspaceStorageKey = "oklch-workspace";

export function pickedColor(state: Pick<Workspace, "color" | "palette">) {
  if (state.palette?.endpoint === "end") return state.palette.end;
  if (state.palette?.endpoint === "middle" && state.palette.middle)
    return state.palette.middle;
  return state.color;
}

function withPickedColor(state: Workspace, color: Color): Workspace {
  color = clampColor(color);
  if (sameColor(pickedColor(state), color)) return state;
  if (state.palette?.endpoint === "middle" && state.palette.middle)
    return { ...state, palette: { ...state.palette, middle: color } };
  return state.palette?.endpoint === "end"
    ? { ...state, palette: { ...state.palette, end: color } }
    : { ...state, color };
}

export function colorHash(color: Color) {
  return `#color=${[color.l, color.c, color.h, color.a].map((value) => round(value, 6)).join(",")}`;
}
export function colorFromHash(hash: string): Color | null {
  const encoded = new URLSearchParams(hash.slice(1)).get("color");
  if (encoded === null) return null;
  const parts = encoded.split(",");
  if (parts.length !== 4 || parts.some((part) => !part.trim())) return null;
  const [l, c, h, a] = parts.map(Number);
  const parsed = colorSchema.safeParse({ l, c, h, a });
  return parsed.success ? parsed.data : null;
}

export function workspaceHash(
  state: Pick<Workspace, "color" | "pickers" | "palette">,
) {
  return `${colorHash(pickedColor(state))}&pickers=${state.pickers.map((picker) => picker.mode).join(",")}`;
}

function pickersFromHash(hash: string, existing: Workspace["pickers"]) {
  const encoded = new URLSearchParams(hash.slice(1)).get("pickers");
  if (encoded === null) return null;
  const modes = encoded
    ? encoded
        .split(",")
        .map((value) => pickerModes.find((mode) => mode === value))
    : [];
  if (modes.some((mode) => mode === undefined)) return null;
  return modes
    .filter((mode) => mode !== undefined)
    .map((mode, index) =>
      existing[index]?.mode === mode
        ? existing[index]
        : { id: crypto.randomUUID(), mode },
    );
}

export function createPresetShare(state: Workspace): PresetShare {
  return {
    version: 2,
    preset: {
      name:
        state.saved.find((preset) => preset.id === state.active)?.name ??
        "Untitled preset",
      source: state.source,
    },
  };
}

export function importPresetShare(
  share: PresetShare,
  local: Workspace,
): Workspace {
  const existing = local.saved.find(
    (preset) =>
      preset.name === share.preset.name &&
      preset.source === share.preset.source,
  );
  const preset = existing ?? { id: crypto.randomUUID(), ...share.preset };
  return {
    ...local,
    active: preset.id,
    source: preset.source,
    selected: null,
    saved: existing ? local.saved : [...local.saved, preset],
  };
}

function readWorkspace(initial: () => Workspace) {
  let state = initial();
  try {
    const stored = workspaceSchema.safeParse(
      JSON.parse(localStorage.getItem(workspaceStorageKey) ?? "null"),
    );
    if (stored.success)
      state = { ...stored.data, saved: normalizePresets(stored.data.saved) };
  } catch {
    /* Continue in memory when browser storage is unavailable. */
  }
  const color = colorFromHash(location.hash);
  const pickers = pickersFromHash(location.hash, state.pickers);
  return {
    ...(color && colorHash(pickedColor(state)) !== colorHash(color)
      ? { ...withPickedColor(state, color), selected: null }
      : state),
    pickers: pickers ?? state.pickers,
  };
}

export function useWorkspace(initial: () => Workspace, shared?: PresetShare) {
  const {
    state,
    change: setState,
    ...historyControls
  } = useWorkspaceHistory(() => {
    const local = readWorkspace(initial);
    return shared ? importPresetShare(shared, local) : local;
  });
  useLayoutEffect(
    function persistColorAndPickersInUrl() {
      const hash = workspaceHash(state);
      if (location.hash !== hash || location.pathname.startsWith("/share/"))
        history.replaceState(null, "", `/${location.search}${hash}`);
    },
    [state.color, state.pickers, state.palette],
  );
  useEffect(
    function persistWorkspaceLocally() {
      try {
        localStorage.setItem(workspaceStorageKey, JSON.stringify(state));
        localStorage.setItem("oklch-presets", JSON.stringify(state.saved));
      } catch {
        /* Continue in memory when browser storage is unavailable. */
      }
    },
    [state],
  );
  useEffect(function restoreColorNavigation() {
    const restore = () => {
      const color = colorFromHash(location.hash);
      setState((previous) => ({
        ...(color
          ? { ...withPickedColor(previous, color), selected: null }
          : previous),
        pickers:
          pickersFromHash(location.hash, previous.pickers) ?? previous.pickers,
      }));
    };
    window.addEventListener("popstate", restore);
    window.addEventListener("hashchange", restore);
    return () => {
      window.removeEventListener("popstate", restore);
      window.removeEventListener("hashchange", restore);
    };
  }, []);
  function set<K extends keyof Workspace>(key: K, value: Workspace[K]) {
    setState(
      (previous) =>
        previous[key] === value ? previous : { ...previous, [key]: value },
      !["selected", "tab", "width"].includes(key),
    );
  }
  function updateState<K extends keyof Workspace>(
    key: K,
    change: (previous: Workspace[K]) => Workspace[K],
  ) {
    setState((previous) => ({ ...previous, [key]: change(previous[key]) }));
  }
  const setColor = (color: Color, record = true) =>
    setState((previous) => withPickedColor(previous, color), record);
  const editWorkspace = (change: WorkspaceChange, group: object) =>
    setState(change, true, group);
  return {
    state,
    set,
    setColor,
    updateState,
    editWorkspace,
    ...historyControls,
  };
}

import { useEffect, useLayoutEffect } from "react";
import { useWorkspaceHistory } from "./useWorkspaceHistory";
import { sameColor } from "./workspaceHistory";
import { normalizePresets } from "./presets";
export {
  pickerModes,
  type PickerMode,
  type Workspace,
} from "./workspaceSchema";
import {
  workspaceSchema,
  colorSchema,
  paletteSchema,
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
  let hash = `${colorHash(pickedColor(state))}&pickers=${state.pickers.map((picker) => picker.mode).join(",")}`;
  if (state.palette) {
    const palette = state.palette;
    hash += `&palette=1&start=${colorHash(state.color).slice(7)}&end=${colorHash(palette.end).slice(7)}&point=${palette.endpoint}&steps=${palette.subdivisions}&interpolation=${palette.mode}&mode=${palette.theme?.mapping ?? "contrast"}&chroma=${palette.theme?.chroma ?? 1}`;
    if (palette.middle) hash += `&middle=${colorHash(palette.middle).slice(7)}`;
    if (
      palette.theme &&
      Object.values(palette.theme.positions).some(
        (positions) => Object.keys(positions).length,
      )
    )
      hash += `&positions=${encodeURIComponent(JSON.stringify(palette.theme.positions))}`;
  }
  return hash;
}

export function restoreWorkspaceHash(
  previous: Workspace,
  hash: string,
): Workspace {
  if (workspaceHash(previous) === hash) return previous;
  const params = new URLSearchParams(hash.slice(1));
  const color = colorFromHash(hash);
  let state = previous;
  if (color || params.has("palette")) {
    let palette: Workspace["palette"];
    let start = color ?? previous.color;
    if (params.get("palette") === "1") {
      try {
        const readColor = (key: string) =>
          colorFromHash(`#color=${params.get(key) ?? ""}`);
        const parsed = paletteSchema.safeParse({
          end: readColor("end"),
          middle: params.has("middle") ? readColor("middle") : undefined,
          endpoint: params.get("point") ?? "start",
          subdivisions: Number(params.get("steps")),
          mode: params.get("interpolation"),
          theme: {
            mapping: params.get("mode") ?? "contrast",
            chroma: Number(params.get("chroma") ?? 1),
            positions: params.has("positions")
              ? JSON.parse(params.get("positions")!)
              : { light: {}, dark: {} },
          },
        });
        const paletteStart = readColor("start");
        if (parsed.success && paletteStart) {
          palette = parsed.data;
          start = paletteStart;
        }
      } catch {
        /* Discard invalid palette URL data. */
      }
    }
    state = { ...previous, color: start, palette, selected: null };
    if (color) state = withPickedColor(state, color);
  }
  return {
    ...state,
    pickers: pickersFromHash(hash, state.pickers) ?? state.pickers,
  };
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
  return restoreWorkspaceHash(state, location.hash);
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
      setState((previous) => restoreWorkspaceHash(previous, location.hash));
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
  return {
    state,
    set,
    setColor,
    updateState,
    ...historyControls,
  };
}

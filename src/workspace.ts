import { useEffect, useLayoutEffect, useState } from "react";
import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import { isRetiredPreset, sourceFor, baseTokens } from "./demo";
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
  type Snapshot,
} from "./workspaceSchema";
import { round, type Color } from "./color";

export const workspaceStorageKey = "oklch-workspace";

export function colorHash(color: Color) {
  return `#color=${[color.l, color.c, color.h, color.a].map((value) => round(value, 6)).join(",")}`;
}
export function colorFromHash(hash: string): Color | null {
  const encoded = new URLSearchParams(hash.slice(1)).get("color");
  const current = encoded !== null;
  const parts = (encoded ?? hash.slice(1)).split(",");
  if (parts.length !== 4 || parts.some((part) => !part.trim())) return null;
  const [l, c, h, a] = parts.map(Number);
  const parsed = colorSchema.safeParse({ l, c, h, a: current ? a : a / 100 });
  return parsed.success ? parsed.data : null;
}

export function workspaceHash(state: Pick<Workspace, "color" | "pickers">) {
  return `${colorHash(state.color)}&pickers=${state.pickers.map((picker) => picker.mode).join(",")}`;
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

export function createSnapshot(state: Workspace): Snapshot {
  const { saved, ...workspace } = state;
  return {
    ...workspace,
    preset: saved.find((preset) => preset.id === state.active) ?? null,
  };
}

export function importSnapshot(
  snapshot: Snapshot,
  local: Workspace,
): Workspace {
  const { preset, ...workspace } = snapshot;
  let active = "";
  const saved = [...local.saved];
  if (preset) {
    const existing = saved.find((item) => item.id === preset.id);
    active =
      existing &&
      (existing.source !== preset.source || existing.name !== preset.name)
        ? crypto.randomUUID()
        : preset.id;
    if (!existing || active !== existing.id)
      saved.push({ ...preset, id: active });
  }
  return { ...workspace, active, saved: normalizePresets(saved) };
}

// Kept for importing the compressed workspace links used before color-only URLs.
export function encodeWorkspace(state: Workspace) {
  const bytes = gzipSync(strToU8(JSON.stringify(state)), { mtime: 0 });
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
export function decodeWorkspace(hash: string): Workspace | null {
  if (!hash.startsWith("#s=")) return null;
  try {
    const binary = atob(
      hash.slice(3).replaceAll("-", "+").replaceAll("_", "/"),
    );
    const state = workspaceSchema.parse(
      JSON.parse(
        strFromU8(gunzipSync(Uint8Array.from(binary, (c) => c.charCodeAt(0)))),
      ),
    );
    const saved = normalizePresets(state.saved);
    const retired = state.saved.find(
      (p) => p.id === state.active && isRetiredPreset(p),
    );
    return {
      ...state,
      saved,
      ...(retired ? { active: "" } : {}),
      ...(retired && state.source === retired.source
        ? {
            active: saved[0]?.id ?? "",
            source: saved[0]?.source ?? sourceFor(baseTokens, ""),
            selected: null,
          }
        : {}),
    };
  } catch {
    return null;
  }
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
  const legacy = decodeWorkspace(location.hash);
  if (legacy) return legacy;
  const color = colorFromHash(location.hash);
  const pickers = pickersFromHash(location.hash, state.pickers);
  return {
    ...state,
    ...(color && colorHash(state.color) !== colorHash(color)
      ? { color, selected: null }
      : {}),
    pickers: pickers ?? state.pickers,
  };
}

export function useWorkspace(initial: () => Workspace, shared?: Snapshot) {
  const [state, setState] = useState(() => {
    const local = readWorkspace(initial);
    return shared ? importSnapshot(shared, local) : local;
  });
  useLayoutEffect(
    function persistColorAndPickersInUrl() {
      const hash = workspaceHash(state);
      if (location.hash !== hash || location.pathname.startsWith("/share/"))
        history.replaceState(null, "", `/${location.search}${hash}`);
    },
    [state.color, state.pickers],
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
      const legacy = decodeWorkspace(location.hash);
      if (legacy) {
        setState(legacy);
        return;
      }
      const color = colorFromHash(location.hash);
      setState((previous) => ({
        ...previous,
        ...(color ? { color, selected: null } : {}),
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
    setState((previous) => ({ ...previous, [key]: value }));
  }
  return { state, set };
}

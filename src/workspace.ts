import { useEffect, useLayoutEffect, useState } from "react";
import { gzipSync, gunzipSync, strToU8, strFromU8 } from "fflate";
import { z } from "zod";
import { isRetiredPreset, sourceFor, baseTokens } from "./demo";
export const pickerModes = ["RGB", "HSL", "HCL", "OKHCL"] as const;
export type PickerMode = (typeof pickerModes)[number];
const schema = z.object({
  version: z.literal(1),
  saved: z.array(
    z.object({ id: z.string(), name: z.string(), source: z.string() }),
  ),
  active: z.string(),
  source: z.string(),
  color: z.object({
    l: z.number().finite(),
    c: z.number().finite(),
    h: z.number().finite(),
    a: z.number().min(0).max(1),
  }),
  selected: z.number().int().nonnegative().nullable(),
  input: z.string(),
  format: z.enum(["css", "percent"]),
  tab: z.enum(["preview", "source", "compiled"]),
  width: z.enum(["100%", "375px", "768px"]),
  pickers: z.array(z.object({ id: z.string(), mode: z.enum(pickerModes) })),
});
export type Workspace = z.infer<typeof schema>;
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
    const state = schema.parse(
      JSON.parse(
        strFromU8(gunzipSync(Uint8Array.from(binary, (c) => c.charCodeAt(0)))),
      ),
    );
    const saved = state.saved.filter((p) => !isRetiredPreset(p));
    if (saved.length === state.saved.length) return state;
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
export function useWorkspace(initial: () => Workspace) {
  const [state, setState] = useState(
    () => decodeWorkspace(location.hash) ?? initial(),
  );
  useLayoutEffect(
    function persistWorkspaceInUrl() {
      const hash = `#s=${encodeWorkspace(state)}`;
      if (location.hash !== hash)
        history.replaceState(
          null,
          "",
          `${location.pathname}${location.search}${hash}`,
        );
    },
    [state],
  );
  useEffect(
    function restoreWorkspaceNavigation() {
      const restore = () =>
        setState(decodeWorkspace(location.hash) ?? initial());
      window.addEventListener("popstate", restore);
      window.addEventListener("hashchange", restore);
      return () => {
        window.removeEventListener("popstate", restore);
        window.removeEventListener("hashchange", restore);
      };
    },
    [initial],
  );
  function set<K extends keyof Workspace>(key: K, value: Workspace[K]) {
    setState((previous) => ({ ...previous, [key]: value }));
  }
  return { state, set };
}

import type { PickerMode } from "./workspaceSchema";

const mappings = [
  { x: 0, y: 1, fixed: 2 },
  { x: 0, y: 2, fixed: 1 },
  { x: 1, y: 2, fixed: 0 },
] as const;

export type PlaneMapping = (typeof mappings)[number];
export type PlaneRequest = {
  mode: PickerMode;
  mapping: PlaneMapping;
  fixedValue: number;
};

export function pickerPlanes(mode: PickerMode) {
  return mode === "RGB" ? mappings : [mappings[2], mappings[1], mappings[0]];
}

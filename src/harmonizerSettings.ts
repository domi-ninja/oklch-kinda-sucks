import type { HarmonizerSettings } from "./workspaceSchema";

export const defaultHarmonizerSettings: HarmonizerSettings = {
  rows: [
    { id: "red", name: "Red", hue: 20 },
    { id: "mustard", name: "Mustard", hue: 90 },
    { id: "turquoise", name: "Turquoise", hue: 180 },
    { id: "azure", name: "Azure", hue: 250 },
    { id: "fuchsia", name: "Fuchsia", hue: 320 },
  ],
  levels: [100, 90, 77, 65, 51, 65, 77, 90, 100].map((contrast, index) => ({
    id: `level-${index}`,
    name: String((index + 1) * 100),
    contrast,
  })),
  gamut: "p3",
  chromaMode: "even",
  darkBackground: "#000000",
  lightBackground: "#ffffff",
  darkColumns: 5,
  selectedRow: null,
};

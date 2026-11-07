import { harmonizePalette } from "./paletteHarmonizer";
import type { PaletteThemeSettings } from "./workspaceSchema";
import type { Color } from "./color";

self.onmessage = (
  event: MessageEvent<{
    id: number;
    colors: Color[];
    path: Color[];
    settings: PaletteThemeSettings;
  }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      palette: harmonizePalette(
        event.data.colors,
        event.data.path,
        event.data.settings,
      ),
    });
  } catch {
    self.postMessage({
      id: event.data.id,
      error: "Could not harmonize the palette.",
    });
  }
};

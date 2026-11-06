import { harmonizePalette } from "./paletteHarmonizer";
import type { Color } from "./color";

self.onmessage = (event: MessageEvent<{ id: number; colors: Color[] }>) => {
  try {
    self.postMessage({
      id: event.data.id,
      palette: harmonizePalette(event.data.colors),
    });
  } catch {
    self.postMessage({
      id: event.data.id,
      error: "Could not harmonize the palette.",
    });
  }
};

import { generateHarmonizer } from "./harmonizer";
import type { HarmonizerSettings } from "./workspaceSchema";

self.onmessage = (
  event: MessageEvent<{ id: number; settings: HarmonizerSettings }>,
) => {
  try {
    self.postMessage({
      id: event.data.id,
      grid: generateHarmonizer(event.data.settings),
    });
  } catch (error) {
    self.postMessage({
      id: event.data.id,
      error:
        error instanceof Error ? error.message : "Could not generate colors.",
    });
  }
};

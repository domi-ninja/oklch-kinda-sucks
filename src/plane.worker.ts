import { channels, coordinateCss, type Coordinates } from "./pickerModes";
import type { PickerMode } from "./workspace";

const canvas = new OffscreenCanvas(256, 160);
const context = canvas.getContext("2d", { colorSpace: "srgb" })!;

self.onmessage = (event: MessageEvent<{ mode: PickerMode; fixed: number }>) => {
  const { mode, fixed } = event.data;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const point: Coordinates =
        mode === "RGB"
          ? [x, (1 - y / 159) * 255, fixed]
          : [
              fixed,
              (x / 255) * channels[mode][1].max,
              (1 - y / 159) * channels[mode][2].max,
            ];
      context.fillStyle = coordinateCss(point, mode);
      context.fillRect(x, y, 1, 1);
    }
  }
  const bitmap = canvas.transferToImageBitmap();
  self.postMessage(bitmap, { transfer: [bitmap] });
};

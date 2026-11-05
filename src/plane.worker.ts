import { channels, coordinateCss, type Coordinates } from "./pickerModes";
import type { PlaneRequest } from "./planes";

const canvas = new OffscreenCanvas(256, 160);
const context = canvas.getContext("2d", { colorSpace: "srgb" })!;

self.onmessage = (event: MessageEvent<PlaneRequest>) => {
  const { mode, mapping, fixedValue } = event.data;
  const point: Coordinates = [0, 0, 0];
  point[mapping.fixed] = fixedValue;
  for (let y = 0; y < canvas.height; y++) {
    point[mapping.y] =
      (1 - y / (canvas.height - 1)) * channels[mode][mapping.y].max;
    for (let x = 0; x < canvas.width; x++) {
      point[mapping.x] =
        (x / (canvas.width - 1)) * channels[mode][mapping.x].max;
      context.fillStyle = coordinateCss(point, mode);
      context.fillRect(x, y, 1, 1);
    }
  }
  const bitmap = canvas.transferToImageBitmap();
  self.postMessage(bitmap, { transfer: [bitmap] });
};

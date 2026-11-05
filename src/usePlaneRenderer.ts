import { useCallback, useEffect, useRef } from "react";
import type { PlaneRequest } from "./planes";

type PlaneJob = { request: PlaneRequest; canvas: HTMLCanvasElement };

// Share one worker across a picker's planes, with at most one pending job per plane.
export function usePlaneRenderer() {
  const worker = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, PlaneJob>());
  const painting = useRef<PlaneJob | null>(null);
  const paint = useCallback(() => {
    if (!worker.current || painting.current) return;
    const job = pending.current.values().next().value;
    if (!job) return;
    pending.current.delete(job.request.mapping.fixed);
    painting.current = job;
    worker.current.postMessage(job.request);
  }, []);

  useEffect(
    function startPlaneRenderer() {
      const instance = new Worker(
        new URL("./plane.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.current = instance;
      instance.onmessage = (event: MessageEvent<ImageBitmap>) => {
        const job = painting.current;
        if (job) {
          const next = pending.current.get(job.request.mapping.fixed);
          if (
            job.canvas.isConnected &&
            (!next || next.request.mode === job.request.mode)
          )
            job.canvas
              .getContext("2d", { colorSpace: "srgb" })
              ?.drawImage(event.data, 0, 0);
        }
        event.data.close();
        painting.current = null;
        paint();
      };
      paint();
      return () => {
        instance.terminate();
        worker.current = null;
        painting.current = null;
        pending.current.clear();
      };
    },
    [paint],
  );

  return useCallback(
    (request: PlaneRequest, canvas: HTMLCanvasElement) => {
      pending.current.set(request.mapping.fixed, { request, canvas });
      paint();
    },
    [paint],
  );
}

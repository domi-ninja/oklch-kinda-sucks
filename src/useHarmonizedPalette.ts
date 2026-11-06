import { useEffect, useRef, useState } from "react";
import type { Color } from "./color";
import type { HarmonizedPalettes } from "./paletteHarmonizer";

type Job = { id: number; colors: Color[]; path: Color[] };
type Reply = { id: number; palette?: HarmonizedPalettes; error?: string };

export function useHarmonizedPalette(colors: Color[], path: Color[]) {
  const worker = useRef<Worker | null>(null);
  const busy = useRef(false);
  const queued = useRef<Job | null>(null);
  const latest = useRef<Job | null>(null);
  const sequence = useRef(0);
  const [result, setResult] = useState<{
    source: Color[];
    path: Color[];
    palette?: HarmonizedPalettes;
    error?: string;
  } | null>(null);
  const send = (job: Job) => {
    busy.current = true;
    worker.current?.postMessage(job);
  };

  useEffect(function startPaletteHarmonizer() {
    const instance = new Worker(
      new URL("./paletteHarmonizer.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = instance;
    busy.current = false;
    instance.onmessage = (event: MessageEvent<Reply>) => {
      busy.current = false;
      if (queued.current) {
        const job = queued.current;
        queued.current = null;
        send(job);
        return;
      }
      const job = latest.current;
      if (job?.id === event.data.id)
        setResult({
          source: job.colors,
          path: job.path,
          palette: event.data.palette,
          error: event.data.error,
        });
    };
    instance.onerror = () => {
      busy.current = false;
      queued.current = null;
      const job = latest.current;
      if (job)
        setResult({
          source: job.colors,
          path: job.path,
          error: "Could not harmonize the palette.",
        });
    };
    return () => {
      instance.terminate();
      worker.current = null;
      busy.current = false;
      queued.current = null;
    };
  }, []);

  useEffect(
    function harmonizePaletteChanges() {
      const job = { id: ++sequence.current, colors, path };
      latest.current = job;
      if (busy.current) queued.current = job;
      else send(job);
    },
    [colors, path],
  );

  return {
    palette: result?.palette,
    pending: result?.source !== colors || result?.path !== path,
    error:
      result?.source === colors && result.path === path
        ? result.error
        : undefined,
  };
}

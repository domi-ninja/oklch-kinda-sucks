import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { HarmonizerGrid, HarmonizerSeed } from "./harmonizer";
import type { HarmonizerSettings } from "./workspaceSchema";

type Request = {
  id: number;
  settings: HarmonizerSettings;
  group: object;
  apply: boolean;
  seed: boolean;
};
type Reply = { id: number; grid?: HarmonizerGrid; error?: string };

export function useHarmonizer(
  value: HarmonizerSettings,
  historyGroup: () => object,
  onApply: (
    settings: HarmonizerSettings,
    seed: HarmonizerSeed | undefined,
    group: object,
  ) => void,
) {
  const [settings, setSettings] = useState(value);
  const [grid, setGrid] = useState<HarmonizerGrid | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState("");
  const worker = useRef<Worker | null>(null);
  const busy = useRef(false);
  const queued = useRef<Request | null>(null);
  const latest = useRef<Request | null>(null);
  const emitted = useRef(value);
  const sequence = useRef(0);
  const apply = useEffectEvent(onApply);
  const send = (request: Request) => {
    busy.current = true;
    worker.current?.postMessage({ id: request.id, settings: request.settings });
  };
  function request(
    next: HarmonizerSettings,
    shouldApply: boolean,
    seed: boolean,
  ) {
    const job = {
      id: ++sequence.current,
      settings: next,
      group: historyGroup(),
      apply: shouldApply,
      seed,
    };
    latest.current = job;
    setPending(true);
    setError("");
    if (busy.current || !worker.current) queued.current = job;
    else send(job);
  }
  useEffect(function startHarmonizerWorker() {
    const instance = new Worker(
      new URL("./harmonizer.worker.ts", import.meta.url),
      { type: "module" },
    );
    worker.current = instance;
    instance.onmessage = (event: MessageEvent<Reply>) => {
      busy.current = false;
      if (queued.current) {
        const job = queued.current;
        queued.current = null;
        send(job);
        return;
      }
      const job = latest.current;
      if (!job || job.id !== event.data.id) return;
      setPending(false);
      if (!event.data.grid) {
        setError(event.data.error ?? "Could not generate colors.");
        return;
      }
      setGrid(event.data.grid);
      if (job.apply) {
        emitted.current = job.settings;
        const row = event.data.grid.rows.find(
          (row) => row.id === job.settings.selectedRow,
        );
        const hue = job.settings.rows.find(
          (row) => row.id === job.settings.selectedRow,
        )?.hue;
        const seed =
          job.seed && row && hue !== undefined
            ? {
                start: row.cells[0].color,
                end: row.cells[row.cells.length - 1].color,
                hue,
              }
            : undefined;
        apply(job.settings, seed, job.group);
      }
    };
    instance.onerror = () => {
      busy.current = false;
      setPending(false);
      setError(
        "Could not generate colors. Close and reopen the harmonizer to retry.",
      );
    };
    queued.current = null;
    busy.current = false;
    request(value, false, false);
    return () => {
      instance.terminate();
      worker.current = null;
    };
  }, []);
  useLayoutEffect(
    function restoreHarmonizerFromHistory() {
      if (value === emitted.current) return;
      emitted.current = value;
      setSettings(value);
      request(value, false, false);
    },
    [value],
  );
  function change(next: HarmonizerSettings, seed = true) {
    setSettings(next);
    request(next, true, seed);
  }
  return { settings, grid, pending, error, change };
}

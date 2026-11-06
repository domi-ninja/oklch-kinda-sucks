import { z } from "zod";
import { presetShareSchema, type PresetShare } from "./workspaceSchema";

export async function saveShare(preset: PresetShare) {
  const response = await fetch("/api/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preset),
  });
  if (!response.ok) throw new Error("Could not create share link. Try again.");
  const { id } = z
    .object({ id: z.string().regex(/^[\w-]{16}$/) })
    .parse(await response.json());
  return new URL(`/share/${id}`, location.origin).href;
}

export async function loadShare(id: string): Promise<PresetShare> {
  const response = await fetch(`/api/shares/${encodeURIComponent(id)}`);
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Share link not found."
        : "Could not open share link. Try again.",
    );
  return presetShareSchema.parse(await response.json());
}

import { z } from "zod";
import { snapshotSchema, type Snapshot } from "./workspaceSchema";

export async function saveShare(snapshot: Snapshot) {
  const response = await fetch("/api/shares", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
  if (!response.ok) throw new Error("Could not create share link. Try again.");
  const { id } = z
    .object({ id: z.string().regex(/^[\w-]{16}$/) })
    .parse(await response.json());
  return new URL(`/share/${id}`, location.origin).href;
}

export async function loadShare(id: string): Promise<Snapshot> {
  const response = await fetch(`/api/shares/${encodeURIComponent(id)}`);
  if (!response.ok)
    throw new Error(
      response.status === 404
        ? "Share link not found."
        : "Could not open share link. Try again.",
    );
  return snapshotSchema.parse(await response.json());
}

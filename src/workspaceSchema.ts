import { z } from "zod";
export const colorSchema = z.object({
  l: z.number().finite(),
  c: z.number().finite(),
  h: z.number().finite(),
  a: z.number().min(0).max(1),
});
export const pickerModes = ["RGB", "HSL", "HCL", "OKHCL"] as const;
export type PickerMode = (typeof pickerModes)[number];
export const workspaceSchema = z.object({
  version: z.literal(1),
  saved: z.array(
    z.object({ id: z.string(), name: z.string(), source: z.string() }),
  ),
  active: z.string(),
  source: z.string(),
  color: colorSchema,
  selected: z.number().int().nonnegative().nullable(),
  tab: z.enum(["preview", "source", "compiled"]),
  width: z.enum(["100%", "375px", "768px"]),
  pickers: z.array(z.object({ id: z.string(), mode: z.enum(pickerModes) })),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const snapshotSchema = workspaceSchema.omit({ saved: true }).extend({
  source: z.string().max(500_000),
  preset: z
    .object({
      id: z.string().max(200),
      name: z.string().max(200),
      source: z.string().max(500_000),
    })
    .nullable(),
  pickers: workspaceSchema.shape.pickers.max(32),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

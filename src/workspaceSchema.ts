import { z } from "zod";
import { clampColor } from "./colorBounds.ts";
export const colorSchema = z
  .object({
    l: z.number().finite(),
    c: z.number().finite(),
    h: z.number().finite(),
    a: z.number().min(0).max(1),
  })
  .transform(clampColor);
export const pickerModes = ["RGB", "HSL", "HCL", "OKHCL"] as const;
export type PickerMode = (typeof pickerModes)[number];
export const palettePoints = ["start", "middle", "end"] as const;
export const paletteSchema = z
  .object({
    end: colorSchema,
    middle: colorSchema.optional(),
    endpoint: z.enum(palettePoints),
    subdivisions: z.number().int().min(1).max(64),
    mode: z.enum(pickerModes),
  })
  .refine(
    (palette) => palette.endpoint !== "middle" || !!palette.middle,
    "The middle control color must exist before selecting it.",
  );
export type Palette = z.infer<typeof paletteSchema>;
export type PaletteEndpoint = Palette["endpoint"];
export const modeGenerationSchema = z.object({
  from: z.enum(["light", "dark"]),
  background: z.number().min(0).max(1),
  contrast: z.number().min(0.5).max(1.5),
  chroma: z.number().min(0).max(1.5),
});
export type ModeGeneration = z.infer<typeof modeGenerationSchema>;
export const workspaceSchema = z.object({
  version: z.literal(1),
  saved: z.array(
    z.object({ id: z.string(), name: z.string(), source: z.string() }),
  ),
  active: z.string(),
  source: z.string(),
  color: colorSchema,
  palette: paletteSchema.optional(),
  modeGeneration: modeGenerationSchema.optional(),
  selected: z.number().int().nonnegative().nullable(),
  tab: z.enum(["preview", "source", "compiled"]),
  width: z.enum(["100%", "375px", "768px"]),
  pickers: z.array(z.object({ id: z.string(), mode: z.enum(pickerModes) })),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const presetShareSchema = z.object({
  version: z.literal(2),
  preset: z.object({
    name: z.string().trim().min(1).max(200),
    source: z.string().max(500_000),
  }),
});
export type PresetShare = z.infer<typeof presetShareSchema>;

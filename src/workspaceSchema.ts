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
export const harmonizerSchema = z
  .object({
    rows: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().max(80),
          hue: z.number().min(0).max(360),
        }),
      )
      .min(1)
      .max(12),
    levels: z
      .array(
        z.object({
          id: z.string(),
          name: z.string().max(40),
          contrast: z.number().min(0).max(106),
          chroma: z.number().min(0).max(0.4).optional(),
        }),
      )
      .min(2)
      .max(16),
    gamut: z.enum(["srgb", "p3"]),
    chromaMode: z.enum(["even", "max"]),
    darkBackground: z.string().regex(/^#[\da-f]{6}$/i),
    lightBackground: z.string().regex(/^#[\da-f]{6}$/i),
    darkColumns: z.number().int().min(1),
    selectedRow: z.string().nullable(),
  })
  .refine(
    (settings) =>
      settings.darkColumns < settings.levels.length &&
      (settings.selectedRow === null ||
        settings.rows.some((row) => row.id === settings.selectedRow)),
    "Select an existing hue row and keep both background groups.",
  );
export type HarmonizerSettings = z.infer<typeof harmonizerSchema>;
export const workspaceSchema = z.object({
  version: z.literal(1),
  saved: z.array(
    z.object({ id: z.string(), name: z.string(), source: z.string() }),
  ),
  active: z.string(),
  source: z.string(),
  color: colorSchema,
  palette: paletteSchema.optional(),
  harmonizer: harmonizerSchema.optional(),
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

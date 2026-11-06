declare module "apcach" {
  export type ColorSpace = "srgb" | "p3";
  type Contrast = {
    bgColor: string;
    fgColor: string;
    cr: number;
    contrastModel: "apca" | "wcag";
    searchDirection: "auto" | "lighter" | "darker";
  };
  export type Apcach = {
    lightness: number;
    chroma: number;
    hue: number;
    alpha: number;
    colorSpace: ColorSpace;
    contrastConfig: Contrast;
  };
  type ChromaSearch = (
    contrast: Contrast,
    hue: number,
    alpha: number,
    colorSpace: ColorSpace,
  ) => Apcach;
  export function crToBg(
    background: string,
    contrast: number,
    model?: "apca" | "wcag",
    direction?: "auto" | "lighter" | "darker",
  ): Contrast;
  export function maxChroma(cap?: number): ChromaSearch;
  export function apcach(
    contrast: Contrast,
    chroma: number | ChromaSearch,
    hue: number,
    alpha?: number,
    colorSpace?: ColorSpace,
  ): Apcach;
  export function calcContrast(
    foreground: string,
    background: string,
    model?: "apca" | "wcag",
    colorSpace?: ColorSpace,
  ): number;
  export function inColorSpace(
    color: Apcach | string,
    colorSpace?: ColorSpace,
  ): boolean;
}

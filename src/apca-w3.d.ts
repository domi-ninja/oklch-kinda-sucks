declare module "apca-w3" {
  export function APCAcontrast(textY: number, backgroundY: number): number;
  export function sRGBtoY(rgb: readonly [number, number, number]): number;
  export function displayP3toY(rgb: readonly [number, number, number]): number;
}

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "./components/ui/tooltip";

export function ColorSwatches({
  display,
  srgb,
}: {
  display: string;
  srgb?: string;
}) {
  return (
    <div className="swatches">
      {[
        {
          label: "Display color",
          color: display,
          description:
            "Your browser renders the original OKLCH color for your screen. On wide-gamut displays, including many Macs, iPhones, and iPads, it can look more vivid than the sRGB preview when the color is outside sRGB. Wider gamut means more saturated colors, not an HDR brightness boost.",
        },
        {
          label: "sRGB preview",
          color: srgb,
          description:
            "The same color converted through an 8-bit sRGB canvas. This is the color used for RGB and hex. sRGB has a smaller color range, so saturated colors can look duller here on wide-gamut screens. Colors within sRGB should look nearly identical. Conversion can slightly change transparent colors.",
        },
      ].map((swatch) => (
        <Tooltip key={swatch.label}>
          <TooltipTrigger asChild>
            <button type="button" className="checker" aria-label={swatch.label}>
              <span
                className="swatch-color"
                style={{ background: swatch.color }}
              >
                <span className="swatch-label">{swatch.label}</span>
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>{swatch.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

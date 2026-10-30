import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ComponentProps } from "react";
const variants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md border px-3 h-10 font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default:
          "bg-neutral-900 text-white border-neutral-900 hover:bg-neutral-700",
        outline: "bg-[#bcbcbc] border-[#838383] hover:bg-[#cccccc]",
        ghost: "border-transparent hover:bg-[#c5c5c5]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
export function Button({
  className,
  variant,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof variants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={twMerge(clsx(variants({ variant }), className))}
      {...props}
    />
  );
}

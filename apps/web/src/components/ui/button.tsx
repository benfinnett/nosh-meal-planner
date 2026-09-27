import * as React from "react";
import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

// Design system button variants cover primary, secondary, text, and error actions.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-sans text-sm font-semibold whitespace-nowrap transition-colors hover:cursor-pointer disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary:
          "border border-transparent bg-primary text-primary-foreground hover:bg-[var(--color-nosh-teal)] hover:text-white",
        error:
          "border border-transparent bg-destructive text-white hover:bg-destructive/90",
        secondary:
          "border border-[var(--control-border)] bg-transparent text-foreground hover:bg-[var(--color-nosh-green)]/10",
        text: "border-none bg-transparent px-1 text-foreground underline-offset-4 hover:bg-[var(--color-nosh-green)]/10",
        "text-error":
          "border-none bg-transparent px-1 text-destructive underline-offset-4 hover:bg-destructive/10",
      },
      size: {
        default: "h-11 px-4 has-[>svg]:px-3",
        sm: "h-9 px-3 has-[>svg]:px-2.5",
        icon: "size-11",
        "icon-sm": "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "primary",
  size = "default",
  render,
  ...props
}: React.ComponentProps<typeof ButtonPrimitive> &
  VariantProps<typeof buttonVariants> & {
    render?: React.ComponentProps<typeof ButtonPrimitive>["render"];
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      render={render}
      {...props}
    />
  );
}

export { Button, buttonVariants };

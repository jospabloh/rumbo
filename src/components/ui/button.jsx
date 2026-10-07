import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

// mario_style: los botones con relleno llevan relieve (play-press, de
// src/styles/mario_style.css) y se hunden al pulsar. ghost y link se quedan planos:
// son texto que se puede pulsar, no botones físicos.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground play-press play-press--primary",
        destructive:
          "bg-destructive text-destructive-foreground play-press play-press--danger",
        outline:
          "border-2 border-input bg-card hover:bg-accent hover:text-accent-foreground play-press play-press--neutral",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 play-press play-press--neutral",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-xl px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

const Button = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'button'> & { asChild?: boolean; variant?: string; size?: string } & React.RefAttributes<HTMLButtonElement>>} */ (
  React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      (<Comp
        className={cn(buttonVariants(/** @type {any} */ ({ variant, size, className })))}
        ref={ref}
        {...props} />)
    );
  })
)
Button.displayName = "Button"

export { Button, buttonVariants }

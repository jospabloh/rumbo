"use client";
import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"

const ToggleGroupContext = React.createContext({
  size: "default",
  variant: "default",
})

const ToggleGroup = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & { variant?: string; size?: string } & React.RefAttributes<React.ElementRef<typeof ToggleGroupPrimitive.Root>>>} */ (
  React.forwardRef(({ className, variant, size, children, ...props }, ref) => (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cn("flex items-center justify-center gap-1", className)}
      {...props}>
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  ))
)

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & { variant?: string; size?: string } & React.RefAttributes<React.ElementRef<typeof ToggleGroupPrimitive.Item>>>} */ (
  React.forwardRef(({ className, children, variant, size, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)

    return (
      (<ToggleGroupPrimitive.Item
        ref={ref}
        className={cn(toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }), className)}
        {...props}>
        {children}
      </ToggleGroupPrimitive.Item>)
    );
  })
)

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }

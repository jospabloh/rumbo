import * as React from "react"

import { cn } from "@/lib/utils"

const Card = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'div'> & React.RefAttributes<HTMLDivElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-2xl border-2 bg-card text-card-foreground play-card", className)}
      {...props} />
  ))
)
Card.displayName = "Card"

const CardHeader = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'div'> & React.RefAttributes<HTMLDivElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props} />
  ))
)
CardHeader.displayName = "CardHeader"

const CardTitle = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'div'> & React.RefAttributes<HTMLDivElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("font-display text-lg font-bold leading-none", className)}
      {...props} />
  ))
)
CardTitle.displayName = "CardTitle"

const CardDescription = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'div'> & React.RefAttributes<HTMLDivElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("text-sm text-muted-foreground", className)}
      {...props} />
  ))
)
CardDescription.displayName = "CardDescription"

const CardContent = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'div'> & React.RefAttributes<HTMLDivElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ))
)
CardContent.displayName = "CardContent"

const CardFooter = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'div'> & React.RefAttributes<HTMLDivElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-6 pt-0", className)}
      {...props} />
  ))
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }

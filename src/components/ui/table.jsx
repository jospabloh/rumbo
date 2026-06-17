import * as React from "react"

import { cn } from "@/lib/utils"

const Table = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'table'> & React.RefAttributes<HTMLTableElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props} />
    </div>
  ))
)
Table.displayName = "Table"

const TableHeader = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'thead'> & React.RefAttributes<HTMLTableSectionElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  ))
)
TableHeader.displayName = "TableHeader"

const TableBody = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'tbody'> & React.RefAttributes<HTMLTableSectionElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props} />
  ))
)
TableBody.displayName = "TableBody"

const TableFooter = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'tfoot'> & React.RefAttributes<HTMLTableSectionElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props} />
  ))
)
TableFooter.displayName = "TableFooter"

const TableRow = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'tr'> & React.RefAttributes<HTMLTableRowElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props} />
  ))
)
TableRow.displayName = "TableRow"

const TableHead = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'th'> & React.RefAttributes<HTMLTableCellElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props} />
  ))
)
TableHead.displayName = "TableHead"

const TableCell = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'td'> & React.RefAttributes<HTMLTableCellElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props} />
  ))
)
TableCell.displayName = "TableCell"

const TableCaption = /** @type {React.ForwardRefExoticComponent<React.ComponentPropsWithoutRef<'caption'> & React.RefAttributes<HTMLTableCaptionElement>>} */ (
  React.forwardRef(({ className, ...props }, ref) => (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props} />
  ))
)
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

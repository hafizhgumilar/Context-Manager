"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn(
      "relative overflow-hidden rounded-[inherit] @container/scroll-area",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
))
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "group/scrollbar relative flex touch-none select-none rounded-full bg-[hsla(var(--scrollbar-track)/0.75)] transition-[background-color,opacity]",
      "data-[state=hidden]:pointer-events-none data-[state=hidden]:opacity-0",
      orientation === "vertical" &&
        "h-full w-3.5 border-l border-l-transparent px-[3px]",
      orientation === "horizontal" &&
        "h-3.5 flex-col border-t border-t-transparent py-[3px]",
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb
      className={cn(
        "relative flex-1 rounded-full bg-gradient-to-b from-[hsla(var(--scrollbar-thumb)/0.95)] to-[hsla(var(--scrollbar-thumb)/0.75)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]",
        "transition-[background-color,box-shadow]",
        orientation === "horizontal" && "from-[hsla(var(--scrollbar-thumb)/0.9)] to-[hsla(var(--scrollbar-thumb)/0.7)]",
      )}
    >
      <span
        className="pointer-events-none absolute inset-[2px] rounded-full bg-white/30 opacity-0 transition-opacity group-hover/scrollbar:opacity-100 group-active/scrollbar:opacity-100"
        aria-hidden="true"
      />
    </ScrollAreaPrimitive.ScrollAreaThumb>
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
))
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName

export { ScrollArea, ScrollBar }

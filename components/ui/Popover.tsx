"use client";
import { Popover as RACPopover, type PopoverProps } from "react-aria-components";
import { cn } from "@/lib/utils";

/** Styled popover box. Enter/exit animation comes from the global [data-entering]/[data-exiting] rules. */
export function Popover({ className, ...props }: PopoverProps) {
  return (
    <RACPopover
      {...props}
      className={(rs) =>
        cn(
          "rounded-control border border-border bg-white shadow-lg outline-none",
          typeof className === "function" ? className(rs) : className,
        )
      }
    />
  );
}

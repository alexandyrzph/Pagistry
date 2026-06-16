"use client";
import { Tooltip as RACTooltip, TooltipTrigger, type TooltipProps } from "react-aria-components";
import { cn } from "@/lib/utils";

export { TooltipTrigger };

export function Tooltip({ className, ...props }: TooltipProps) {
  return (
    <RACTooltip
      {...props}
      offset={6}
      className={(rs) =>
        cn(
          "rounded-md bg-fg px-2 py-1 text-xs font-medium text-white shadow-md",
          typeof className === "function" ? className(rs) : className,
        )
      }
    />
  );
}

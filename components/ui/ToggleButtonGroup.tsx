"use client";
import {
  ToggleButtonGroup as RACToggleButtonGroup,
  ToggleButton as RACToggleButton,
  type ToggleButtonGroupProps as RACToggleButtonGroupProps,
  type ToggleButtonProps as RACToggleButtonProps,
} from "react-aria-components";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface ToggleButtonGroupProps extends RACToggleButtonGroupProps {}

export function ToggleButtonGroup({ className, ...props }: ToggleButtonGroupProps) {
  return (
    <RACToggleButtonGroup
      {...props}
      className={(rs) =>
        cn(
          "flex gap-0.5 rounded-control bg-bg-subtle p-0.5",
          typeof className === "function" ? className(rs) : className,
        )
      }
    />
  );
}

export interface ToggleButtonProps extends Omit<RACToggleButtonProps, "children"> {
  children?: ReactNode;
}

export function ToggleButton({ className, ...props }: ToggleButtonProps) {
  return (
    <RACToggleButton
      {...props}
      className={(rs) =>
        cn(
          "inline-flex flex-1 items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] px-2.5 py-1 text-sm font-medium outline-none transition-colors",
          "text-fg-muted hover:text-fg",
          "data-[selected]:bg-white data-[selected]:text-brand-600 data-[selected]:shadow-xs",
          "data-[focus-visible]:ring-4 data-[focus-visible]:ring-brand-100",
          "disabled:pointer-events-none disabled:opacity-50",
          typeof className === "function" ? className(rs) : className,
        )
      }
    />
  );
}

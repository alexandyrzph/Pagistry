"use client";
import {
  SwitchField,
  SwitchButton,
  type SwitchFieldProps,
} from "react-aria-components";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface SwitchProps extends Omit<SwitchFieldProps, "children"> {
  children?: ReactNode;
}

export function Switch({ className, children, ...props }: SwitchProps) {
  // SwitchField (div) owns the state + hidden <input>; SwitchButton (label) is the
  // clickable track+thumb and carries data-selected / data-focus-visible, so the
  // Tailwind `group` lives on the button.
  return (
    <SwitchField {...props}>
      <SwitchButton
        className={(rs) =>
          cn(
            "group flex items-center gap-2 text-sm text-fg",
            typeof className === "function" ? className(rs) : className,
          )
        }
      >
        <span
          className={cn(
            "flex h-5 w-9 items-center rounded-full bg-border-strong p-0.5 transition",
            "group-data-[selected]:bg-brand-600 group-data-[focus-visible]:ring-4 group-data-[focus-visible]:ring-brand-100",
          )}
        >
          <span className="size-4 rounded-full bg-white shadow-xs transition group-data-[selected]:translate-x-4" />
        </span>
        {children}
      </SwitchButton>
    </SwitchField>
  );
}

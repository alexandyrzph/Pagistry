"use client";
import {
  CheckboxField,
  CheckboxButton,
  type CheckboxFieldProps,
} from "react-aria-components";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface CheckboxProps extends Omit<CheckboxFieldProps, "children"> {
  children?: ReactNode;
}

export function Checkbox({ className, children, ...props }: CheckboxProps) {
  // CheckboxField (div) owns the state + hidden <input>; CheckboxButton (label)
  // is the clickable indicator+label and carries data-selected / data-indeterminate
  // / data-focus-visible, so the Tailwind `group` lives on the button.
  return (
    <CheckboxField {...props}>
      <CheckboxButton
        className={(rs) =>
          cn(
            "group flex items-center gap-2 text-sm text-fg",
            typeof className === "function" ? className(rs) : className,
          )
        }
      >
        {({ isSelected, isIndeterminate }) => (
          <>
            <span
              className={cn(
                "flex size-4 items-center justify-center rounded-[5px] border border-border-strong bg-white transition",
                "group-data-[selected]:border-brand-600 group-data-[selected]:bg-brand-600",
                "group-data-[indeterminate]:border-brand-600 group-data-[indeterminate]:bg-brand-600",
                "group-data-[focus-visible]:ring-4 group-data-[focus-visible]:ring-brand-100",
              )}
            >
              {isIndeterminate ? (
                <Minus aria-hidden className="size-3 text-white" />
              ) : isSelected ? (
                <Check aria-hidden className="size-3 text-white" />
              ) : null}
            </span>
            {children}
          </>
        )}
      </CheckboxButton>
    </CheckboxField>
  );
}

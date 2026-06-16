"use client";
import {
  RadioGroup as RACRadioGroup, type RadioGroupProps as RACRadioGroupProps,
  Radio as RACRadio, type RadioProps as RACRadioProps, Label,
} from "react-aria-components";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface RadioGroupProps extends Omit<RACRadioGroupProps, "children"> {
  label?: ReactNode;
  children?: ReactNode;
}

export function RadioGroup({ label, className, children, ...props }: RadioGroupProps) {
  return (
    <RACRadioGroup
      {...props}
      className={(rs) =>
        cn("flex flex-col gap-2", typeof className === "function" ? className(rs) : className)
      }
    >
      {label && <Label className="text-sm font-medium text-fg">{label}</Label>}
      {children}
    </RACRadioGroup>
  );
}

export interface RadioProps extends Omit<RACRadioProps, "children"> {
  children?: ReactNode;
}

export function Radio({ className, children, ...props }: RadioProps) {
  return (
    <RACRadio
      {...props}
      className={(rs) =>
        cn("group flex items-center gap-2 text-sm text-fg", typeof className === "function" ? className(rs) : className)
      }
    >
      <span
        className={cn(
          "flex size-4 items-center justify-center rounded-full border border-border-strong bg-white transition",
          "group-data-[selected]:border-brand-600 group-data-[focus-visible]:ring-4 group-data-[focus-visible]:ring-brand-100",
        )}
      >
        <span className="size-2 rounded-full bg-brand-600 opacity-0 transition group-data-[selected]:opacity-100" />
      </span>
      {children}
    </RACRadio>
  );
}

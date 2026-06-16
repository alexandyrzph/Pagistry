"use client";
import { Switch as RACSwitch, type SwitchProps as RACSwitchProps } from "react-aria-components";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface SwitchProps extends Omit<RACSwitchProps, "children"> {
  children?: ReactNode;
}

export function Switch({ className, children, ...props }: SwitchProps) {
  return (
    <RACSwitch
      {...props}
      className={(rs) =>
        cn("group flex items-center gap-2 text-sm text-fg", typeof className === "function" ? className(rs) : className)
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
    </RACSwitch>
  );
}

"use client";
import {
  Menu as RACMenu, MenuItem as RACMenuItem,
  type MenuProps as RACMenuProps, type MenuItemProps,
} from "react-aria-components";
import { cn } from "@/lib/utils";
import { Popover } from "./Popover";

export function Menu<T extends object>({ className, ...props }: RACMenuProps<T>) {
  return (
    <Popover className="min-w-44 p-1">
      <RACMenu
        {...props}
        className={(rs) => cn("outline-none", typeof className === "function" ? className(rs) : className)}
      />
    </Popover>
  );
}

export function MenuItem({ className, ...props }: MenuItemProps<object>) {
  return (
    <RACMenuItem
      {...props}
      className={(rs) =>
        cn(
          "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-fg outline-none",
          "data-[focused]:bg-bg-subtle data-[disabled]:opacity-50",
          typeof className === "function" ? className(rs) : className,
        )
      }
    />
  );
}

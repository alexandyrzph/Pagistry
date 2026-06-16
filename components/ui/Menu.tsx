"use client";
import { Menu as RACMenu, MenuItem, Popover, type MenuProps as RACMenuProps } from "react-aria-components";
import { cn } from "@/lib/utils";

export function Menu<T extends object>({ className, ...props }: RACMenuProps<T>) {
  return (
    <Popover className="min-w-44 rounded-control border border-border bg-white p-1 shadow-lg outline-none">
      <RACMenu
        {...props}
        className={(rs) => cn("outline-none", typeof className === "function" ? className(rs) : className)}
      />
    </Popover>
  );
}

export function MenuItemRow({ className, ...props }: React.ComponentProps<typeof MenuItem>) {
  return (
    <MenuItem
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

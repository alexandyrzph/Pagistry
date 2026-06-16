"use client";
import {
  Select as RACSelect, type SelectProps as RACSelectProps,
  Label, Button, SelectValue, ListBox, ListBoxItem, type Key,
} from "react-aria-components";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { Popover } from "./Popover";

export interface SelectOption { id: Key; label: string }

export interface SelectProps extends Omit<RACSelectProps<SelectOption>, "children"> {
  label?: ReactNode;
  items: SelectOption[];
  placeholder?: string;
}

export function Select({ label, items, placeholder = "Select…", className, ...props }: SelectProps) {
  return (
    <RACSelect
      {...props}
      className={(rs) =>
        cn("flex flex-col gap-1.5", typeof className === "function" ? className(rs) : className)
      }
    >
      {label && <Label className="text-sm font-medium text-fg">{label}</Label>}
      <Button
        className={cn(
          "flex items-center justify-between gap-2 rounded-control border border-border-strong bg-white px-3 py-2 text-sm text-fg shadow-xs outline-none transition",
          "hover:border-fg-subtle data-[focus-visible]:border-brand-400 data-[focus-visible]:ring-4 data-[focus-visible]:ring-brand-100",
        )}
      >
        <SelectValue className="data-[placeholder]:text-fg-subtle">
          {({ selectedText, isPlaceholder }) =>
            isPlaceholder ? placeholder : selectedText
          }
        </SelectValue>
        <ChevronDown className="size-4 text-fg-subtle" aria-hidden={true} />
      </Button>
      <Popover className="min-w-[var(--trigger-width)] p-1">
        <ListBox items={items} className="outline-none">
          {(item) => (
            <ListBoxItem
              id={item.id}
              textValue={item.label}
              className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-sm text-fg outline-none data-[focused]:bg-bg-subtle data-[selected]:font-medium"
            >
              {({ isSelected }) => (
                <>
                  {item.label}
                  {isSelected && <Check className="size-4 text-brand-600" />}
                </>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </RACSelect>
  );
}

"use client";
import {
  TextField as RACTextField,
  type TextFieldProps as RACTextFieldProps,
  Label,
  TextArea,
  FieldError,
} from "react-aria-components";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface TextareaProps extends RACTextFieldProps {
  label?: ReactNode;
  placeholder?: string;
  rows?: number;
  errorMessage?: string;
}

export function Textarea({
  label,
  placeholder,
  rows = 4,
  errorMessage,
  className,
  ...props
}: TextareaProps) {
  return (
    <RACTextField
      {...props}
      isInvalid={!!errorMessage || props.isInvalid}
      className={cn(
        "flex flex-col gap-1.5",
        typeof className === "string" ? className : undefined,
      )}
    >
      {label && (
        <Label className="text-sm font-medium text-fg">{label}</Label>
      )}
      <TextArea
        rows={rows}
        placeholder={placeholder}
        className={cn(
          "w-full resize-y rounded-control border border-border-strong bg-white px-3 py-2 text-sm text-fg shadow-xs outline-none transition",
          "placeholder:text-fg-subtle hover:border-fg-subtle",
          "focus:border-brand-400 focus:ring-4 focus:ring-brand-100",
          "data-[invalid]:border-danger-500",
        )}
      />
      <FieldError className="text-xs text-danger-600">{errorMessage}</FieldError>
    </RACTextField>
  );
}

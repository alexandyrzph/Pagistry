"use client";

import { useEffect, useRef } from "react";
import * as Icons from "lucide-react";
import type { CSSProperties } from "react";

export const ALIGN_OPTIONS = [
  { label: "Left", value: "left" },
  { label: "Center", value: "center" },
  { label: "Right", value: "right" },
];

// ---------------------------------------------------------------------------
// Shared primitives used by block render components.
// ---------------------------------------------------------------------------

/** Render any lucide icon by name, with a safe fallback. */
export function DynamicIcon({
  name,
  size = 24,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const Cmp =
    (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Square;
  return <Cmp size={size} className={className} style={style} />;
}

type EditableProps = {
  as?: keyof React.JSX.IntrinsicElements;
  value: string;
  onCommit: (value: string) => void;
  editable: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

/**
 * Uncontrolled contentEditable element. Seeds its text from `value` when not
 * focused (avoids caret jumps), commits on blur. Plain Enter commits unless
 * multiline; Shift+Enter always inserts a line break.
 */
export function Editable({
  as = "span",
  value,
  onCommit,
  editable,
  multiline = false,
  placeholder,
  className,
  style,
  id,
}: EditableProps) {
  const ref = useRef<HTMLElement>(null);
  // Keep the latest callbacks available to the native listeners below.
  const cb = useRef({ onCommit, multiline });
  cb.current = { onCommit, multiline };

  // Seed text from `value` only while not focused (avoids caret jumps). Uses the
  // element's own document so it works inside the canvas iframe too.
  useEffect(() => {
    const el = ref.current;
    if (el && el.ownerDocument.activeElement !== el && el.innerText !== value) {
      el.innerText = value ?? "";
    }
  }, [value]);

  // Native listeners — React doesn't delegate synthetic events across the
  // cross-document iframe portal, so contentEditable must wire them directly.
  useEffect(() => {
    const el = ref.current;
    if (!el || !editable) return;
    const onBlur = () => cb.current.onCommit(el.innerText);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        el.blur();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !cb.current.multiline) {
        e.preventDefault();
        el.blur();
      }
      // don't let block-level shortcuts fire while typing
      e.stopPropagation();
    };
    el.addEventListener("blur", onBlur);
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("blur", onBlur);
      el.removeEventListener("keydown", onKeyDown);
    };
  }, [editable]);

  const Tag = as as any;

  if (!editable) {
    return (
      <Tag id={id} className={className} style={style}>
        {value}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref as any}
      id={id}
      className={className}
      style={style}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
    />
  );
}

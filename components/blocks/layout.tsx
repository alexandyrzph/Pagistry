"use client";

import { cn } from "@/lib/utils";
import type { BlockRenderProps } from "@/lib/blocks/registry-types";

export function SectionBlock({ style, className, id, children }: BlockRenderProps) {
  return (
    <section id={id} className={cn("relative w-full", className)} style={style}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

export function ColumnsBlock({
  block,
  viewport,
  style,
  className,
  id,
  children,
}: BlockRenderProps) {
  const layout: string = block.props.layout ?? "1-1";
  const cols = layout.split("-").filter(Boolean);
  const template =
    viewport === "mobile" ? "1fr" : cols.map((c) => `${c}fr`).join(" ");
  return (
    <div
      id={id}
      className={cn("pb-columns grid w-full gap-6", className)}
      style={{ gridTemplateColumns: template, ...style }}
    >
      {children}
    </div>
  );
}

export function ColumnBlock({ style, className, id, children }: BlockRenderProps) {
  return (
    <div
      id={id}
      className={cn("flex min-w-0 flex-col gap-4", className)}
      style={style}
    >
      {children}
    </div>
  );
}

export function SpacerBlock({ block, style, className, id }: BlockRenderProps) {
  const height = block.props.height ?? 48;
  return (
    <div
      id={id}
      className={className}
      style={{ height: typeof height === "number" ? `${height}px` : height, ...style }}
    />
  );
}

export function DividerBlock({ block, style, className, id }: BlockRenderProps) {
  const {
    color = "#e2e8f0",
    thickness = 1,
    width = "100%",
    lineStyle = "solid",
  } = block.props;
  return (
    <div id={id} className={className} style={style}>
      <div
        style={{
          margin: "0 auto",
          width,
          borderTopColor: color,
          borderTopWidth: typeof thickness === "number" ? `${thickness}px` : thickness,
          borderTopStyle: lineStyle,
        }}
      />
    </div>
  );
}


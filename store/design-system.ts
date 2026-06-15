"use client";

import { create } from "zustand";
import type { ColorToken, StyleProps, TextStyle } from "@/lib/types";
import { uid } from "@/lib/utils";

// Site-wide shared design system (color tokens + text styles). Loaded once per
// editor session from /api/site and debounce-saved back. Lives outside the page
// document store so it never enters page undo/redo and is shared across pages.

type DesignSystemState = {
  colors: ColorToken[];
  textStyles: TextStyle[];
  loaded: boolean;

  load: () => Promise<void>;

  addColor: (value?: string) => ColorToken;
  updateColor: (id: string, patch: Partial<Omit<ColorToken, "id">>) => void;
  removeColor: (id: string) => void;

  addTextStyle: (name: string, props?: StyleProps) => TextStyle;
  updateTextStyle: (id: string, patch: Partial<Omit<TextStyle, "id">>) => void;
  updateTextStyleProp: (id: string, key: keyof StyleProps, value: string) => void;
  removeTextStyle: (id: string) => void;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export const useDesignSystem = create<DesignSystemState>((set, get) => {
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const { colors, textStyles } = get();
      void fetch("/api/site", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ colors, textStyles }),
      }).catch(() => {});
    }, 600);
  };

  return {
    colors: [],
    textStyles: [],
    loaded: false,

    load: async () => {
      try {
        const r = await fetch("/api/site");
        const d = await r.json();
        set({
          colors: Array.isArray(d.colors) ? d.colors : [],
          textStyles: Array.isArray(d.textStyles) ? d.textStyles : [],
          loaded: true,
        });
      } catch {
        set({ loaded: true });
      }
    },

    addColor: (value = "#6366f1") => {
      const n = get().colors.length + 1;
      const token: ColorToken = { id: uid().replace(/[^a-z0-9]/gi, ""), name: `Color ${n}`, value };
      set((s) => ({ colors: [...s.colors, token] }));
      persist();
      return token;
    },
    updateColor: (id, patch) => {
      set((s) => ({ colors: s.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      persist();
    },
    removeColor: (id) => {
      set((s) => ({ colors: s.colors.filter((c) => c.id !== id) }));
      persist();
    },

    addTextStyle: (name, props = {}) => {
      const ts: TextStyle = { id: uid().replace(/[^a-z0-9]/gi, ""), name, props };
      set((s) => ({ textStyles: [...s.textStyles, ts] }));
      persist();
      return ts;
    },
    updateTextStyle: (id, patch) => {
      set((s) => ({ textStyles: s.textStyles.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
      persist();
    },
    updateTextStyleProp: (id, key, value) => {
      set((s) => ({
        textStyles: s.textStyles.map((t) => {
          if (t.id !== id) return t;
          const props = { ...t.props };
          if (value === "" || value == null) delete props[key];
          else (props as Record<string, string>)[key] = value;
          return { ...t, props };
        }),
      }));
      persist();
    },
    removeTextStyle: (id) => {
      set((s) => ({ textStyles: s.textStyles.filter((t) => t.id !== id) }));
      persist();
    },
  };
});

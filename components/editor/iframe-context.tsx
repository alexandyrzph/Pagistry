"use client";

import { createContext, useContext } from "react";

// Shared handle to the canvas iframe. The editable tree is portaled *into* the
// iframe (real viewport → accurate breakpoints), while selection chrome, the
// block toolbar/drag-handle and the floating inspector live in the editor
// document and position themselves *over* the iframe. `tick` bumps whenever the
// iframe scrolls/resizes/relayouts so those overlays re-measure.

export type FrameInfo = { el: HTMLIFrameElement; doc: Document; body: HTMLElement };

type Ctx = {
  frame: FrameInfo | null;
  tick: number;
  register: (f: FrameInfo | null) => void;
  bump: () => void;
};

const IframeCtx = createContext<Ctx>({
  frame: null,
  tick: 0,
  register: () => {},
  bump: () => {},
});

export const IframeProvider = IframeCtx.Provider;
export const useIframe = () => useContext(IframeCtx);

"use client";

import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useRichText } from "@/store/richtext";

type Props = {
  value: string;
  onCommit: (html: string) => void;
  editable: boolean;
  className?: string;
  style?: CSSProperties;
  id?: string;
};

// Rich text via Tiptap. The editor runs inside the canvas iframe; formatting is
// driven by the top-document RichTextToolbar through the shared richtext store.
export function RichText(props: Props) {
  return props.editable ? <RichEditor {...props} /> : <RichView {...props} />;
}

function RichView({ value, className, style, id }: Props) {
  return (
    <div
      id={id}
      className={cn("pc-rich", className)}
      style={style}
      dangerouslySetInnerHTML={{ __html: value || "" }}
    />
  );
}

function RichEditor({ value, onCommit, className, style, id }: Props) {
  const commit = useRef(onCommit);
  commit.current = onCommit;
  const timer = useRef<number>(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
    ],
    content: value || "",
    editorProps: { attributes: { class: cn("pc-rich focus:outline-none", className) } },
    onUpdate: ({ editor }) => {
      useRichText.getState().bump();
      window.clearTimeout(timer.current);
      const html = editor.getHTML();
      timer.current = window.setTimeout(() => commit.current(html), 250);
    },
    onFocus: ({ editor }) => useRichText.getState().setEditor(editor),
    onSelectionUpdate: () => useRichText.getState().bump(),
    onBlur: () => useRichText.getState().bump(),
  });

  // External value changes (undo/redo, page switch) — only when not editing.
  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== (value || "")) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  // Release the active editor when this block unmounts.
  useEffect(
    () => () => {
      if (useRichText.getState().editor === editor) useRichText.getState().setEditor(null);
    },
    [editor]
  );

  return <EditorContent editor={editor} id={id} style={style} />;
}

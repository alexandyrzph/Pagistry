"use client";

import { useState } from "react";
import { uploadFile } from "@/lib/upload";

/**
 * Upload a single file via `uploadFile`, tracking progress and surfacing errors.
 * Calls `onUploaded(url)` on success.
 */
export function useUpload(onUploaded: (url: string) => void) {
  const [uploading, setUploading] = useState(false);
  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    try {
      const a = await uploadFile(file);
      onUploaded(a.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }
  return { uploading, upload };
}

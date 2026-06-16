"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { uploadFile, formatBytes, type UploadedAsset } from "@/lib/upload";
import { Modal } from "@/components/ui/Modal";
import { useAlert } from "@/components/ui/dialog-provider";

export function AssetPicker({
  open,
  kind = "image",
  onSelect,
  onClose,
}: {
  open: boolean;
  kind?: "image" | "all";
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const alert = useAlert();
  const [assets, setAssets] = useState<UploadedAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/assets${kind === "image" ? "?kind=image" : ""}`)
      .then((r) => r.json())
      .then((d) => setAssets(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, kind]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded: UploadedAsset[] = [];
      for (const f of Array.from(files)) uploaded.push(await uploadFile(f));
      setAssets((a) => [...uploaded, ...a]);
      if (uploaded[0]) {
        onSelect(uploaded[0].url);
        onClose();
      }
    } catch (e) {
      await alert({ title: "Upload failed", message: e instanceof Error ? e.message : "Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="flex max-h-[80vh] max-w-2xl flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3.5">
              <h2 className="text-sm font-bold tracking-tight text-zinc-900">Media library</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-indigo-700 disabled:opacity-60"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  Upload
                </button>
                <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600">
                  <X size={18} />
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept={kind === "image" ? "image/*" : undefined}
                multiple
                className="hidden"
                onChange={(e) => onFiles(e.target.files)}
              />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="pc-skeleton aspect-square rounded-lg" />
                  ))}
                </div>
              ) : assets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <div className="rounded-xl bg-zinc-100 p-3 text-zinc-400"><Upload size={20} /></div>
                  <p className="text-sm font-semibold text-zinc-600">No uploads yet</p>
                  <p className="text-xs text-zinc-400">Upload an image to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {assets.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => {
                        onSelect(a.url);
                        onClose();
                      }}
                      title={`${a.name} · ${formatBytes(a.size)}`}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
                    >
                      {a.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-medium text-zinc-500">
                          {a.name}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
    </Modal>
  );
}

export type UploadedAsset = {
  id: string;
  url: string;
  name: string;
  type: string;
  size: number;
};

/** Upload a single file to /api/upload and return its asset record. */
export async function uploadFile(file: File): Promise<UploadedAsset> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error || "Upload failed");
  }
  return res.json();
}

export function formatBytes(n: number): string {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

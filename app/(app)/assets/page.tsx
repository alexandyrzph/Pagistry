import { FileImage, File } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireWorkspace } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;

function isImage(asset: { type: string; url: string }): boolean {
  return asset.type.startsWith("image") || IMAGE_EXTS.test(asset.url);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AssetsPage() {
  const { workspace } = await requireWorkspace();
  const assets = await prisma.asset.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Assets</h1>
      <p className="mt-1 text-sm text-zinc-500">Images and files uploaded to this workspace.</p>

      <div className="mt-8">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-6 py-16 text-center">
            <div className="rounded-2xl bg-zinc-100 p-4">
              <FileImage size={24} className="text-zinc-400" />
            </div>
            <p className="text-sm font-medium text-zinc-700">No assets yet.</p>
            <p className="text-xs text-zinc-400">
              Upload images and files from any editor's asset picker.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {assets.map((a) => (
              <div
                key={a.id}
                className="group rounded-2xl border border-zinc-200 bg-white overflow-hidden"
              >
                <div className="h-36 bg-zinc-100 flex items-center justify-center overflow-hidden">
                  {isImage(a) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.url}
                      alt={a.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <File size={32} className="text-zinc-300" />
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-xs font-medium text-zinc-700">{a.name}</p>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{formatBytes(a.size)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

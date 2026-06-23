import { api } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

export async function uploadThumbnail(
  pageId: string,
  blob: Blob,
): Promise<{ url: string; version: number } | null> {
  const fd = new FormData();
  fd.append("file", blob, `${pageId}.png`);
  try {
    const { data } = await api.post<{ url: string; version: number }>(
      endpoints.pages.thumbnail(pageId),
      fd,
    );
    return data;
  } catch {
    return null;
  }
}

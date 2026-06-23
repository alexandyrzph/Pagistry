import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

vi.mock("@/lib/api/client", () => ({
  api: { post: vi.fn() },
}));

import { api } from "@/lib/api/client";
import { uploadThumbnail } from "@/lib/thumbnails/upload-thumbnail";

const post = api.post as unknown as Mock;

describe("uploadThumbnail", () => {
  beforeEach(() => post.mockReset());

  it("posts FormData with the file to the page thumbnail endpoint and returns data", async () => {
    post.mockResolvedValueOnce({ data: { url: "/uploads/thumbnails/p1.png", version: 42 } });
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });

    const res = await uploadThumbnail("p1", blob);

    expect(res).toEqual({ url: "/uploads/thumbnails/p1.png", version: 42 });
    const [url, body] = post.mock.calls[0];
    expect(url).toBe("/api/pages/p1/thumbnail");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBeInstanceOf(Blob);
  });

  it("returns null when the request throws", async () => {
    post.mockRejectedValueOnce(new Error("network"));
    const blob = new Blob([new Uint8Array([1])], { type: "image/png" });
    expect(await uploadThumbnail("p1", blob)).toBeNull();
  });
});

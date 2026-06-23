import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
  siteId: "site1",
  page: null as null | { id: string; updatedAt: Date },
  written: [] as string[],
  upserts: [] as unknown[],
}));

vi.mock("@/lib/api/api-handler", () => ({
  withSiteRole: (_min: string, fn: (c: { site: { id: string } }) => unknown) =>
    fn({ site: { id: state.siteId } }),
}));
vi.mock("@/lib/rate-limit", () => ({ enforce: () => null }));
vi.mock("fs/promises", () => ({
  mkdir: vi.fn(async () => {}),
  writeFile: vi.fn(async (p: string) => {
    state.written.push(p);
  }),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    page: { findFirst: vi.fn(async () => state.page) },
    pageThumbnail: {
      upsert: vi.fn(async (args: unknown) => {
        state.upserts.push(args);
      }),
    },
  },
}));

import { POST } from "@/app/api/pages/[id]/thumbnail/route";

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}
function reqWithFile() {
  const fd = new FormData();
  fd.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }), "p1.png");
  return new Request("http://localhost/api/pages/p1/thumbnail", { method: "POST", body: fd });
}

describe("POST /api/pages/[id]/thumbnail", () => {
  beforeEach(() => {
    state.written = [];
    state.upserts = [];
  });

  it("404 when the page is not found for this site", async () => {
    state.page = null;
    const res = await POST(reqWithFile(), ctx("p1"));
    expect(res.status).toBe(404);
  });

  it("400 when no file is provided", async () => {
    state.page = { id: "p1", updatedAt: new Date(1000) };
    const res = await POST(
      new Request("http://localhost/api/pages/p1/thumbnail", {
        method: "POST",
        body: new FormData(),
      }),
      ctx("p1"),
    );
    expect(res.status).toBe(400);
  });

  it("413 when the file exceeds the size limit", async () => {
    state.page = { id: "p1", updatedAt: new Date(1000) };
    const oversizeFile = {
      size: 8 * 1024 * 1024 + 1,
      type: "image/png",
      arrayBuffer: async () => new ArrayBuffer(0),
    };
    const stubFd = { get: () => oversizeFile } as unknown as FormData;
    const req = new Request("http://localhost/api/pages/p1/thumbnail", { method: "POST" });
    req.formData = async () => stubFd;
    const res = await POST(req, ctx("p1"));
    expect(res.status).toBe(413);
  });

  it("writes the PNG, upserts, and returns { url, version }", async () => {
    state.page = { id: "p1", updatedAt: new Date(1000) };
    const res = await POST(reqWithFile(), ctx("p1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; version: number };
    expect(body).toEqual({ url: "/uploads/thumbnails/p1.png", version: 1000 });
    expect(state.written.some((p) => p.endsWith("p1.png"))).toBe(true);
    expect(state.upserts).toHaveLength(1);
  });
});

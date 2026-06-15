import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/workspace";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

let seq = 0;

// POST /api/upload — multipart file upload → saved under /public/uploads
export async function POST(req: Request) {
  const a = await requireApiRole("EDITOR");
  if ("response" in a) return a.response;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 413 });
  }

  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = slugify(dot >= 0 ? file.name.slice(0, dot) : file.name) || "file";
  const filename = `${base}-${Date.now().toString(36)}${(seq++).toString(36)}${ext ? "." + ext : ""}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  const url = `/uploads/${filename}`;
  const asset = await prisma.asset.create({
    data: { name: file.name.slice(0, 200), url, type: file.type || "", size: file.size, workspaceId: a.workspace.id },
  });

  return NextResponse.json(
    { id: asset.id, url: asset.url, name: asset.name, type: asset.type, size: asset.size },
    { status: 201 }
  );
}

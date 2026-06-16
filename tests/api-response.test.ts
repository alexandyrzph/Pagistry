import { describe, it, expect } from "vitest";
import { json, created, error, badRequest, unauthorized, forbidden, notFound } from "@/lib/api/api-response";

describe("api-response", () => {
  it("json() defaults to 200 and echoes data", async () => {
    const r = json({ a: 1 });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(await r.json()).toEqual({ a: 1 });
  });

  it("created() is 201", () => {
    expect(created({ id: "x" }).status).toBe(201);
  });

  it("error() wraps the message under `error`", async () => {
    const r = error(418, "teapot");
    expect(r.status).toBe(418);
    expect(await r.json()).toEqual({ error: "teapot" });
  });

  it("named helpers carry the right status and default message", async () => {
    expect(badRequest().status).toBe(400);
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    const nf = notFound();
    expect(nf.status).toBe(404);
    expect(await nf.json()).toEqual({ error: "Not found" });
  });

  it("serializes Date fields to ISO strings (NextResponse.json parity)", async () => {
    const r = json({ at: new Date("2026-01-02T03:04:05.000Z") });
    expect(await r.json()).toEqual({ at: "2026-01-02T03:04:05.000Z" });
  });
});

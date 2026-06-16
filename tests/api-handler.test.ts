import { describe, it, expect } from "vitest";
import { runGuarded } from "@/lib/api/api-handler";
import type { WorkspaceCtx } from "@/lib/auth/workspace";

const fakeCtx: WorkspaceCtx = {
  user: { id: "u1", email: "a@b.com", name: "A", onboarded: true },
  workspace: { id: "w1", name: "W", slug: "w" },
  role: "EDITOR",
};

describe("runGuarded", () => {
  it("runs the handler with the ctx when the guard passes", async () => {
    const r = await runGuarded(fakeCtx, (ws) => new Response(ws.workspace.id));
    expect(await r.text()).toBe("w1");
  });

  it("short-circuits with the guard's response and never calls the handler", async () => {
    let called = false;
    const blocked = await runGuarded({ response: new Response("nope", { status: 403 }) }, () => {
      called = true;
      return new Response("should not run");
    });
    expect(blocked.status).toBe(403);
    expect(await blocked.text()).toBe("nope");
    expect(called).toBe(false);
  });

  it("awaits an async handler", async () => {
    const r = await runGuarded(fakeCtx, async () => new Response("ok"));
    expect(await r.text()).toBe("ok");
  });
});

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import type { FormEvent, ReactNode } from "react";

const { alertSpy, confirmSpy } = vi.hoisted(() => ({
  alertSpy: vi.fn(() => Promise.resolve()),
  confirmSpy: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("@/lib/api/client", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/components/ui/dialog-provider", () => ({
  useConfirm: () => confirmSpy,
  useAlert: () => alertSpy,
  DialogProvider: ({ children }: { children: ReactNode }) => children,
}));

import { api } from "@/lib/api/client";
import {
  useDomainsManager,
  DomainCard,
  type Domain,
} from "@/components/app-shell/site/DomainsManager.parts";

const get = api.get as unknown as Mock;
const post = api.post as unknown as Mock;
const del = api.delete as unknown as Mock;

function domain(over: Partial<Domain> = {}): Domain {
  return {
    id: "d1",
    hostname: "store.example.com",
    status: "PENDING",
    isPrimary: false,
    verifiedAt: null,
    lastError: null,
    dns: {
      ownership: { record: "_pc.store", type: "TXT", value: "pc-verify=abc" },
      routing: { record: "store", type: "CNAME", value: "edge.pagistry.com" },
    },
    ...over,
  };
}

function evt() {
  return { preventDefault: vi.fn() } as unknown as FormEvent & { preventDefault: Mock };
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
  alertSpy.mockClear();
  confirmSpy.mockClear();
  get.mockResolvedValue({ data: [] });
});

describe("useDomainsManager.add", () => {
  it("ignores submit when the hostname is blank and never posts", async () => {
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    const e = evt();
    await act(async () => {
      await result.current.add(e);
    });
    expect(e.preventDefault).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("posts the trimmed hostname, clears the field, and reloads on success", async () => {
    post.mockResolvedValueOnce({ data: {} });
    get.mockResolvedValue({ data: [domain()] });
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    act(() => result.current.setHostname("  store.example.com  "));
    await act(async () => {
      await result.current.add(evt());
    });
    expect(post).toHaveBeenCalledWith("/api/domains", { hostname: "store.example.com" });
    expect(result.current.hostname).toBe("");
    expect(result.current.addErr).toBe("");
    expect(result.current.adding).toBe(false);
    expect(result.current.domains).toHaveLength(1);
  });

  it("surfaces the server error message from an axios failure", async () => {
    post.mockRejectedValueOnce(
      Object.assign(new Error("bad"), {
        isAxiosError: true,
        response: { data: { error: "Domain already in use" } },
      }),
    );
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    act(() => result.current.setHostname("dup.example.com"));
    await act(async () => {
      await result.current.add(evt());
    });
    expect(result.current.addErr).toBe("Domain already in use");
    expect(result.current.adding).toBe(false);
  });

  it("falls back to a generic message for a non-axios failure", async () => {
    post.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    act(() => result.current.setHostname("nope.example.com"));
    await act(async () => {
      await result.current.add(evt());
    });
    expect(result.current.addErr).toBe("Could not add that domain");
  });
});

describe("useDomainsManager.verify", () => {
  it("does not alert when the domain comes back ACTIVE", async () => {
    post.mockResolvedValueOnce({ data: { domain: { status: "ACTIVE" } } });
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    await act(async () => {
      await result.current.verify(domain());
    });
    expect(post).toHaveBeenCalledWith("/api/domains/d1/verify", {});
    expect(alertSpy).not.toHaveBeenCalled();
    expect(result.current.verifyingId).toBeNull();
  });

  it("alerts with the server lastError when still not active", async () => {
    post.mockResolvedValueOnce({
      data: { domain: { status: "PENDING", lastError: "No DNS records found" } },
    });
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    await act(async () => {
      await result.current.verify(domain());
    });
    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: "No DNS records found" }),
    );
    expect(result.current.verifyingId).toBeNull();
  });

  it("alerts a retry message when the verify request rejects", async () => {
    post.mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    await act(async () => {
      await result.current.verify(domain());
    });
    expect(alertSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Couldn't verify" }));
    expect(result.current.verifyingId).toBeNull();
  });
});

describe("useDomainsManager.remove", () => {
  it("deletes then reloads once the confirm resolves true", async () => {
    del.mockResolvedValueOnce({ data: {} });
    const { result } = renderHook(() => useDomainsManager());
    await act(async () => {});
    await act(async () => {
      await result.current.remove(domain());
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(del).toHaveBeenCalledWith("/api/domains/d1");
  });
});

describe("DomainCard", () => {
  it("renders a pending manageable domain with verify, remove, and DNS rows", () => {
    const onVerify = vi.fn();
    const onRemove = vi.fn();
    const d = domain();
    render(
      <DomainCard
        domain={d}
        canManage
        verifyingId={null}
        onVerify={onVerify}
        onRemove={onRemove}
      />,
    );
    expect(screen.getByText("store.example.com")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("pc-verify=abc")).toBeInTheDocument();
    expect(screen.getByText("edge.pagistry.com")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(onVerify).toHaveBeenCalledWith(d);
    fireEvent.click(screen.getByRole("button", { name: "Remove store.example.com" }));
    expect(onRemove).toHaveBeenCalledWith(d);
  });

  it("renders an active primary domain without verify or DNS rows", () => {
    render(
      <DomainCard
        domain={domain({ status: "ACTIVE", isPrimary: true })}
        canManage
        verifyingId={null}
        onVerify={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
    expect(screen.queryByText("pc-verify=abc")).toBeNull();
  });

  it("shows the last error for an ERROR domain and reflects the verifying id", () => {
    render(
      <DomainCard
        domain={domain({ status: "ERROR", lastError: "Ownership record missing" })}
        canManage
        verifyingId="d1"
        onVerify={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Ownership record missing")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
  });

  it("hides the action buttons when the viewer cannot manage", () => {
    render(
      <DomainCard
        domain={domain()}
        canManage={false}
        verifyingId={null}
        onVerify={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByText("pc-verify=abc")).toBeInTheDocument();
  });
});

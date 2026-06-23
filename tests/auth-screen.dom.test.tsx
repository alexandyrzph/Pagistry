// Component + internal-handler coverage for the auth card (jsdom).
// Renders the exported AuthScreen and drives its internal `submit` handler
// across every outcome (login onboarded/not, signup, forgot sent/with-link,
// error), plus direct renders of the exported AuthFormFields / AuthFooter
// sub-components for all four modes.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const { post, get, replace, refresh } = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  api: { post, get },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn(), prefetch: vi.fn() }),
}));

import { AuthScreen } from "@/components/auth/AuthScreen";
import { AuthFooter, AuthFormFields, type Mode } from "@/components/auth/AuthScreen.helpers";

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  get.mockResolvedValue({ data: { providers: [] } });
  replace.mockReset();
  refresh.mockReset();
});

function setInput(root: HTMLElement, selector: string, value: string) {
  const el = root.querySelector(selector) as HTMLInputElement;
  fireEvent.change(el, { target: { value } });
}

describe("AuthScreen submit handler", () => {
  it("login + onboarded routes to `next` and refreshes", async () => {
    post.mockResolvedValue({ data: { onboarded: true } });
    const { container } = render(<AuthScreen mode="login" next="/dash" />);
    setInput(container, 'input[type="email"]', "a@b.com");
    setInput(container, 'input[type="password"]', "secret123");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dash"));
    expect(post).toHaveBeenCalledWith("/api/auth/login", {
      email: "a@b.com",
      password: "secret123",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("login + not onboarded routes to /onboarding", async () => {
    post.mockResolvedValue({ data: { onboarded: false } });
    const { container } = render(<AuthScreen mode="login" />);
    setInput(container, 'input[type="email"]', "a@b.com");
    setInput(container, 'input[type="password"]', "secret123");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("signup posts the name/email/password payload", async () => {
    post.mockResolvedValue({ data: { onboarded: false } });
    const { container } = render(<AuthScreen mode="signup" />);
    setInput(container, 'input[type="text"]', "Jane Doe");
    setInput(container, 'input[type="email"]', "jane@x.com");
    setInput(container, 'input[type="password"]', "secret123");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/auth/signup", {
        name: "Jane Doe",
        email: "jane@x.com",
        password: "secret123",
      }),
    );
    expect(replace).toHaveBeenCalledWith("/onboarding");
  });

  it("forgot with a reset URL shows the success card and a link (no redirect)", async () => {
    post.mockResolvedValue({ data: { resetUrl: "http://localhost/reset?token=abc" } });
    const { container } = render(<AuthScreen mode="forgot" />);
    setInput(container, 'input[type="email"]', "a@b.com");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText(/If an account exists/i)).toBeInTheDocument();
    expect(screen.getByText(/Open reset page/i)).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("forgot without a reset URL shows the success card but no link", async () => {
    post.mockResolvedValue({ data: {} });
    const { container } = render(<AuthScreen mode="forgot" />);
    setInput(container, 'input[type="email"]', "a@b.com");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText(/If an account exists/i)).toBeInTheDocument();
    expect(screen.queryByText(/Open reset page/i)).toBeNull();
  });

  it("surfaces the server error message when the request rejects", async () => {
    post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Invalid credentials" } },
    });
    const { container } = render(<AuthScreen mode="login" />);
    setInput(container, 'input[type="email"]', "a@b.com");
    setInput(container, 'input[type="password"]', "secret123");
    fireEvent.submit(container.querySelector("form") as HTMLFormElement);

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("AuthScreen rendering", () => {
  it("renders the reset copy with a password field and no OAuth row", () => {
    const { container } = render(<AuthScreen mode="reset" token="t1" />);
    expect(screen.getByText("Set a new password")).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).not.toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it("surfaces an initial error derived from the errorCode prop", async () => {
    render(<AuthScreen mode="login" errorCode="oauth_denied" />);
    expect(await screen.findByText("Sign-in was cancelled.")).toBeInTheDocument();
  });
});

function renderFields(overrides: Partial<React.ComponentProps<typeof AuthFormFields>>) {
  const props: React.ComponentProps<typeof AuthFormFields> = {
    mode: "login",
    name: "",
    email: "",
    password: "",
    onName: () => {},
    onEmail: () => {},
    onPassword: () => {},
    error: null,
    pending: false,
    cta: "Go",
    ...overrides,
  };
  return render(<AuthFormFields {...props} />);
}

describe("AuthFormFields", () => {
  it("signup renders all fields and wires every onChange", () => {
    const onName = vi.fn();
    const onEmail = vi.fn();
    const onPassword = vi.fn();
    const { container } = renderFields({
      mode: "signup",
      onName,
      onEmail,
      onPassword,
      cta: "Create",
    });

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create/ })).toBeInTheDocument();

    setInput(container, 'input[type="text"]', "Jane");
    setInput(container, 'input[type="email"]', "j@x.com");
    setInput(container, 'input[type="password"]', "pw");
    expect(onName).toHaveBeenCalledWith("Jane");
    expect(onEmail).toHaveBeenCalledWith("j@x.com");
    expect(onPassword).toHaveBeenCalledWith("pw");
  });

  it("login shows email, password and the forgot link, but no name", () => {
    renderFields({ mode: "login" });
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.getByText("Forgot?")).toBeInTheDocument();
    expect(screen.queryByText("Name")).toBeNull();
  });

  it("forgot shows only the email field", () => {
    const { container } = renderFields({ mode: "forgot" });
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.queryByText("Password")).toBeNull();
    expect(screen.queryByText("Name")).toBeNull();
    expect(screen.queryByText("Forgot?")).toBeNull();
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it("reset shows only the password field", () => {
    const { container } = renderFields({ mode: "reset" });
    expect(screen.getByText("Password")).toBeInTheDocument();
    expect(screen.queryByText("Email")).toBeNull();
    expect(screen.queryByText("Name")).toBeNull();
    expect(screen.queryByText("Forgot?")).toBeNull();
    expect(container.querySelector('input[type="email"]')).toBeNull();
  });

  it("renders the error message when one is passed", () => {
    renderFields({ mode: "login", error: "Bad creds" });
    expect(screen.getByText("Bad creds")).toBeInTheDocument();
  });

  it("disables the submit button and hides the cta while pending", () => {
    renderFields({ mode: "login", pending: true, cta: "Sign in" });
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.queryByText("Sign in")).toBeNull();
  });
});

describe("AuthFooter", () => {
  const cases: Array<[Mode, RegExp, string | null]> = [
    ["login", /New to Pagistry/, "/signup"],
    ["signup", /Already have an account/, "/login"],
    ["forgot", /Back to sign in/, "/login"],
    ["reset", /Back to sign in/, "/login"],
  ];

  it.each(cases)("mode %s shows the right copy and link", (mode, copy, href) => {
    const { container } = render(<AuthFooter mode={mode} />);
    expect(screen.getByText(copy)).toBeInTheDocument();
    if (href) expect(container.querySelector(`a[href="${href}"]`)).not.toBeNull();
  });
});

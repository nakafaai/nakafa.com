import { describe, expect, it } from "@effect/vitest";

const createAuthClient = vi.hoisted(() => vi.fn(() => ({ page: "client" })));

vi.mock("better-auth/react", () => ({ createAuthClient }));

describe("readAuthClient", () => {
  it("creates no Better Auth client on import, and one shared client on first read", async () => {
    vi.resetModules();
    createAuthClient.mockClear();
    const { readAuthClient } = await import("@/lib/auth/client");

    expect(createAuthClient).not.toHaveBeenCalled();
    expect(readAuthClient()).toBe(readAuthClient());
    expect(createAuthClient).toHaveBeenCalledOnce();
  });
});

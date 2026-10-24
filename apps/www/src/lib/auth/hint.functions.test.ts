// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { signedInHintHandler } from "@/lib/auth/hint.functions";

const current = vi.hoisted(() => ({
  request: new Request("https://nakafa.com/"),
}));

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => current.request,
}));

describe("signed-in hint function", () => {
  it("answers true for a request whose cookies carry the signed-in hint", async () => {
    current.request = new Request("https://nakafa.com/", {
      headers: { cookie: "theme=dark; nakafa-signed-in=1" },
    });

    expect(await signedInHintHandler()).toBe(true);
  });

  it("answers false for a request whose cookies carry no hint, or no cookie at all", async () => {
    current.request = new Request("https://nakafa.com/", {
      headers: { cookie: "theme=dark" },
    });
    expect(await signedInHintHandler()).toBe(false);

    current.request = new Request("https://nakafa.com/");
    expect(await signedInHintHandler()).toBe(false);
  });
});

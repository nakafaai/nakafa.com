import { describe, expect, it } from "@effect/vitest";
import { signedInHead } from "@/lib/account/head";

describe("signedInHead", () => {
  it("keeps an indexable screen indexable and names its canonical address", () => {
    const head = signedInHead({
      canonicalPath: "/en/chat",
      description: "Ask Nakafa",
      indexable: true,
      locale: "en",
      title: "New chat",
    });
    expect(head.links).toContainEqual(
      expect.objectContaining({ rel: "canonical" })
    );
    expect(head.meta).toContainEqual({
      content: "index,follow",
      name: "robots",
    });
  });

  it("marks a private screen noindex", () => {
    const head = signedInHead({
      canonicalPath: "/en",
      description: "Settings",
      indexable: false,
      locale: "en",
      title: "Settings",
    });
    expect(head.meta).toContainEqual({
      content: "noindex,nofollow",
      name: "robots",
    });
  });
});

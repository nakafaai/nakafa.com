import { describe, expect, it } from "@effect/vitest";
import { privateHead, profileHead, signedInHead } from "@/lib/account/head";

const profileTab = {
  canonicalPath: "/en/@nabil/chat",
  description: "Chat",
  indexable: false,
  locale: "en",
  title: "Chat",
} as const;

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

describe("profileHead", () => {
  it("names the canonical address of the tab and no hreflang alternates", () => {
    const head = profileHead(profileTab);
    expect(head.links).toEqual([
      expect.objectContaining({
        href: "https://nakafa.com/en/@nabil/chat",
        rel: "canonical",
      }),
    ]);
  });

  it("keeps the title, the description and the social entries of the tab", () => {
    const head = profileHead(profileTab);
    expect(head.meta).toContainEqual({ title: "Chat - Nakafa" });
    expect(head.meta).toContainEqual({
      content: "Chat",
      name: "description",
    });
    expect(head.meta).toContainEqual(
      expect.objectContaining({ property: "og:title" })
    );
  });
});

describe("privateHead", () => {
  it("keeps only the title, the description and the noindex rules", () => {
    const head = privateHead({
      canonicalPath: "/en",
      description: "Settings",
      indexable: true,
      locale: "en",
      title: "Settings",
    });
    expect(head.links).toEqual([]);
    expect(head.meta).toEqual([
      { title: "Settings - Nakafa" },
      { content: "Settings", name: "description" },
      { content: "noindex,nofollow", name: "robots" },
      { content: "noindex,nofollow,noimageindex", name: "googlebot" },
    ]);
  });
});

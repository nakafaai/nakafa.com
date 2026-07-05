import { describe, expect, it } from "vitest";
import { createContentViewKey } from "@/lib/hooks/views";

describe("createContentViewKey", () => {
  it("keeps anonymous and signed-in view attempts separate", () => {
    const input = {
      contentId: "asset:id:material:mathematics:algebra:linear",
      locale: "id",
    } as const;

    expect(
      createContentViewKey({ ...input, authenticated: false })
    ).not.toEqual(createContentViewKey({ ...input, authenticated: true }));
  });

  it("keeps signed-in learners in separate dedupe buckets", () => {
    const input = {
      authenticated: true,
      contentId: "asset:id:material:mathematics:algebra:linear",
      locale: "id",
    } as const;

    expect(
      createContentViewKey({ ...input, signedInUserId: "user-first" })
    ).not.toEqual(
      createContentViewKey({ ...input, signedInUserId: "user-second" })
    );
  });

  it("preserves verified placement context in the dedupe key", () => {
    expect(
      createContentViewKey({
        authenticated: true,
        contentId: "asset:id:material:mathematics:algebra:linear",
        context: {
          mode: "placement",
          nodeKey: "node:linear",
          programKey: "snbt",
        },
        locale: "id",
        signedInUserId: "user-1",
      })
    ).toBe(
      "user:user-1:id:asset:id:material:mathematics:algebra:linear:placement:snbt:node:linear"
    );
  });

  it("keeps untracked content attempts in a stable anonymous bucket", () => {
    expect(
      createContentViewKey({
        authenticated: false,
        contentId: null,
        locale: "id",
      })
    ).toBe("anonymous:id:untracked:canonical::");
  });
});

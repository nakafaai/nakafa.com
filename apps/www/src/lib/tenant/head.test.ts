// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { schoolHead } from "@/lib/tenant/head";

describe("schoolHead", () => {
  it("titles every school page after the school and keeps it out of search", () => {
    expect(schoolHead("Harapan")).toEqual({
      meta: [
        { title: "Harapan" },
        { content: "noindex,nofollow", name: "robots" },
      ],
    });
  });
});

import { describe, expect, it } from "vitest";
import { getCanonicalCurrentPageContentUrl } from "@/app/api/chat/content";

describe("app/api/chat/content", () => {
  it("builds the canonical current-page URL from locale and slug", () => {
    expect(
      getCanonicalCurrentPageContentUrl({
        locale: "id",
        slug: "/materi/matematika/aljabar/",
      })
    ).toBe("https://nakafa.com/id/materi/matematika/aljabar");
  });
});

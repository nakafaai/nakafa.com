import { describe, expect, it } from "vitest";
import {
  getAppNavigationViewer,
  getForYouNavigationHref,
  getForYouNavigationItems,
} from "@/components/sidebar/data/navigation";

describe("sidebar navigation", () => {
  it("keeps a persisted role when one is available", () => {
    expect(getAppNavigationViewer({ isPending: false, role: "teacher" })).toBe(
      "teacher"
    );
    expect(getAppNavigationViewer({ isPending: false, role: null })).toBe(
      "guest"
    );
  });

  it("uses a neutral viewer while the user query is pending", () => {
    const viewer = getAppNavigationViewer({
      isPending: true,
      role: null,
    });

    expect(viewer).toBe("pending");
    expect(getForYouNavigationItems(viewer).map((item) => item.id)).toEqual([
      "subject",
      "tryOut",
      "askNina",
    ]);
  });

  it("shows try out to every app navigation audience", () => {
    const expectedItemIds = ["subject", "tryOut", "askNina"];
    const viewers = [
      "pending",
      "guest",
      "student",
      "teacher",
      "parent",
      "administrator",
    ] as const;

    for (const viewer of viewers) {
      expect(getForYouNavigationItems(viewer).map((item) => item.id)).toEqual(
        expectedItemIds
      );
    }
  });

  it("uses localized hrefs only when a navigation item owns them", () => {
    const [subject, , askNina] = getForYouNavigationItems("teacher");

    expect(subject).toBeDefined();
    expect(askNina).toBeDefined();
    expect(getForYouNavigationHref(subject, "id")).toBe("/kurikulum/merdeka");
    expect(getForYouNavigationHref(subject, "en")).toBe("/curriculum/merdeka");
    expect(getForYouNavigationHref(askNina, "id")).toBe("/chat");
  });
});

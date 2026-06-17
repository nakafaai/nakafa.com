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
  });

  it("uses a neutral viewer while the user query is pending", () => {
    const viewer = getAppNavigationViewer({
      isPending: true,
      role: null,
    });

    expect(viewer).toBe("pending");
    expect(getForYouNavigationItems(viewer).map((item) => item.id)).toEqual([
      "subject",
      "askNina",
    ]);
  });

  it("shows try out to guests and students", () => {
    expect(
      getForYouNavigationItems(
        getAppNavigationViewer({ isPending: false, role: null })
      ).map((item) => item.id)
    ).toEqual(["subject", "tryOut", "askNina"]);

    expect(getForYouNavigationItems("student").map((item) => item.id)).toEqual([
      "subject",
      "tryOut",
      "askNina",
    ]);
  });

  it("hides try out from non-student roles", () => {
    expect(getForYouNavigationItems("teacher").map((item) => item.id)).toEqual([
      "subject",
      "askNina",
    ]);

    expect(getForYouNavigationItems("parent").map((item) => item.id)).toEqual([
      "subject",
      "askNina",
    ]);

    expect(
      getForYouNavigationItems("administrator").map((item) => item.id)
    ).toEqual(["subject", "askNina"]);
  });

  it("uses localized hrefs only when a navigation item owns them", () => {
    const [subject, askNina] = getForYouNavigationItems("teacher");

    expect(subject).toBeDefined();
    expect(askNina).toBeDefined();
    expect(getForYouNavigationHref(subject, "id")).toBe("/kurikulum/merdeka");
    expect(getForYouNavigationHref(subject, "en")).toBe("/curriculum/merdeka");
    expect(getForYouNavigationHref(askNina, "id")).toBe("/chat");
  });
});

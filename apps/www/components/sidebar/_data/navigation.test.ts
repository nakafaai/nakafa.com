import { describe, expect, it } from "vitest";
import {
  getAppNavigationViewer,
  getForYouNavigationItems,
} from "@/components/sidebar/_data/navigation";

describe("sidebar navigation", () => {
  it("keeps a persisted role when one is available", () => {
    expect(getAppNavigationViewer("teacher")).toBe("teacher");
  });

  it("shows try out to guests and students", () => {
    expect(
      getForYouNavigationItems(getAppNavigationViewer(null)).map(
        (item) => item.id
      )
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
});

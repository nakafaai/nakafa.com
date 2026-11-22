import { describe, expect, it } from "@effect/vitest";
import { isPageComplaint } from "@/e2e/support/console";

/** A console message of one type and text. */
const said = (type: string, text: string) => ({
  text: () => text,
  type: () => type,
});

describe("isPageComplaint", () => {
  it("counts the page's errors and warnings, and none of its other messages", () => {
    expect(isPageComplaint(said("error", "Uncaught TypeError"))).toBe(true);
    expect(isPageComplaint(said("warning", "Deprecated API"))).toBe(true);
    expect(isPageComplaint(said("log", "ready"))).toBe(false);
  });

  it("leaves out what the test browser makes the console say", () => {
    expect(
      isPageComplaint(
        said(
          "warning",
          "[PostHog.js] Events are being dropped because the user agent looks like a bot. Set `opt_out_useragent_filter: true` to capture them."
        )
      )
    ).toBe(false);
    expect(
      isPageComplaint(
        said(
          "warning",
          '[JavaScript Warning: "This site appears to use a scroll-linked positioning effect."]'
        )
      )
    ).toBe(false);
  });
});

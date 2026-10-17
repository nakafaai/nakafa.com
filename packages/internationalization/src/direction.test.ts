import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { textDirection } from "@repo/internationalization/src/direction";

describe("textDirection", () => {
  it("reads Arabic right to left through the same helper as the routed locales", () => {
    expect(textDirection("ar")).toBe("rtl");
  });

  it.each(ACTIVE_APP_LOCALE_CODES)("reads %s left to right", (locale) => {
    expect(textDirection(locale)).toBe("ltr");
  });
});

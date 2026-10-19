// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { readServerTranslator } from "@repo/internationalization/src/translator";

describe("readServerTranslator", () => {
  it("translates one namespace in the locale it is given", async () => {
    const translate = await readServerTranslator({
      locale: "id",
      namespace: "Common",
    });

    expect(translate("published")).toBe("Diterbitkan");
  });

  it("translates the same key in English for the English locale", async () => {
    const translate = await readServerTranslator({
      locale: "en",
      namespace: "Common",
    });

    expect(translate("published")).toBe("Published");
  });
});

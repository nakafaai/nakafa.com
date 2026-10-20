// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import de from "@repo/internationalization/dictionaries/standalone/de.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/standalone/id.json" with {
  type: "json",
};
import { readStandaloneMessages } from "@/lib/i18n/standalone";

describe("standalone messages", () => {
  it("reads the standalone dictionary of each locale", () => {
    expect(readStandaloneMessages("de")).toStrictEqual(de);
    expect(readStandaloneMessages("id")).toStrictEqual(id);
    expect(readStandaloneMessages("en").NotFound.title).toBeTypeOf("string");
  });
});

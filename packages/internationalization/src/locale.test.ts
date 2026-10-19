import { describe, expect, it } from "@effect/vitest";
import { decodeLocale } from "@repo/internationalization/src/locale";
import { Option } from "effect";

describe("public locale decoding", () => {
  it.each(["en", "id", "de"])("decodes the public locale %s", (locale) => {
    expect(decodeLocale(locale)).toStrictEqual(Option.some(locale));
  });

  it.each(["fr", "EN", "", " de", undefined, null, 42])(
    "rejects %s, which names no public locale",
    (value) => {
      expect(Option.isNone(decodeLocale(value))).toBe(true);
    }
  );
});

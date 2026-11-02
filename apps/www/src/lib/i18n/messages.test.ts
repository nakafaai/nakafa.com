import { describe, expect, it } from "@effect/vitest";
import { Option, Schema } from "effect";
import { RouteMessagesInput } from "@/lib/i18n/messages";

describe("route messages input", () => {
  it("refuses a locale and a namespace that the contracts do not name", () => {
    const decode = Schema.decodeUnknownOption(RouteMessagesInput);
    expect(
      Option.isNone(decode({ locale: "fr", namespaces: ["Common"] }))
    ).toBe(true);
    expect(
      Option.isNone(decode({ locale: "en", namespaces: ["Unknown"] }))
    ).toBe(true);
    expect(
      Option.isSome(decode({ locale: "en", namespaces: ["Common"] }))
    ).toBe(true);
  });
});

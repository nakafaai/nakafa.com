// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Option, Record as Rec, Schema } from "effect";
import {
  RouteMessagesInput,
  routeMessagesHandler,
} from "@/lib/i18n/messages.functions";

describe("route messages", () => {
  it("returns only the namespaces that the route declares", () => {
    const messages = routeMessagesHandler({
      data: { locale: "en", namespaces: ["Common", "Pricing"] },
    });
    expect(Rec.keys(messages)).toStrictEqual(["Common", "Pricing"]);
    expect(messages.Common).toStrictEqual(en.Common);
  });

  it("returns the messages of the requested locale", () => {
    const messages = routeMessagesHandler({
      data: { locale: "de", namespaces: ["Common"] },
    });
    expect(messages.Common).toStrictEqual(de.Common);
  });

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

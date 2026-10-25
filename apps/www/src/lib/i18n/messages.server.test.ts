// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Record as Rec } from "effect";
import { routeMessagesHandler } from "@/lib/i18n/messages.server";

describe("route messages on the server", () => {
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
});

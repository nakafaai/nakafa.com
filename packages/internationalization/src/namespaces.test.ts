import { describe, expect, it } from "@effect/vitest";
import de from "@repo/internationalization/dictionaries/de.json" with {
  type: "json",
};
import id from "@repo/internationalization/dictionaries/id.json" with {
  type: "json",
};
import {
  MESSAGE_NAMESPACES,
  MessageNamespaceSchema,
  pickRouteMessages,
} from "@repo/internationalization/src/namespaces";
import { Array as Arr, Order, Record as Rec, Schema } from "effect";

/** The sorted names of an object's keys. */
const sortedKeys = (value: object) => Arr.sort(Order.String)(Rec.keys(value));

describe("message namespaces", () => {
  it("gives every locale the same namespaces", () => {
    for (const locale of ["de", "en", "id"] as const) {
      expect(
        sortedKeys(pickRouteMessages(locale, MESSAGE_NAMESPACES))
      ).toStrictEqual(Arr.sort(Order.String)(MESSAGE_NAMESPACES));
    }
  });

  it("returns only the namespaces that a route declares", () => {
    const messages = pickRouteMessages("id", ["Common", "NotFound"]);
    expect(sortedKeys(messages)).toStrictEqual(["Common", "NotFound"]);
    expect(messages.Common).toStrictEqual(id.Common);
  });

  it("returns the messages of the locale asked for", () => {
    expect(pickRouteMessages("de", ["Common"]).Common).toStrictEqual(de.Common);
  });

  it("decodes a declared namespace and refuses an unknown one", () => {
    expect(Schema.is(MessageNamespaceSchema)("Common")).toBe(true);
    expect(Schema.is(MessageNamespaceSchema)("Unknown")).toBe(false);
  });
});

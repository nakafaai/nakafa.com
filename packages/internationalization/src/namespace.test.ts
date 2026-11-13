import { describe, expect, it } from "@effect/vitest";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import enStandalone from "@repo/internationalization/dictionaries/standalone/en.json" with {
  type: "json",
};
import {
  MESSAGE_NAMESPACES,
  MessageNamespaceSchema,
} from "@repo/internationalization/src/namespace";
import { Array as Arr, Order, Record as Rec, Schema } from "effect";

describe("message namespaces", () => {
  it("lists exactly the namespaces that the dictionaries define", () => {
    expect(Arr.sort(Order.String)(MESSAGE_NAMESPACES)).toStrictEqual(
      Arr.sort(Order.String)(Rec.keys({ ...en, ...enStandalone }))
    );
  });

  it("decodes a declared namespace and refuses an unknown one", () => {
    expect(Schema.is(MessageNamespaceSchema)("Common")).toBe(true);
    expect(Schema.is(MessageNamespaceSchema)("Unknown")).toBe(false);
  });
});

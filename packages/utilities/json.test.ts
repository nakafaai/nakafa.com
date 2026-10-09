import { describe, expect, it } from "@effect/vitest";
import {
  encodeJsonText,
  encodePrettyJsonText,
  JsonTextSchema,
} from "@repo/utilities/json";
import { Effect, Schema } from "effect";

describe("encodeJsonText", () => {
  it("writes the same text as JSON.stringify, keeping escapes and key order", () => {
    const value = {
      outer: {
        text: 'say "hi"\n',
        count: 3,
        nothing: null,
        list: [1, "two", false],
        inner: { zebra: true, alpha: "kept" },
      },
    };

    expect(encodeJsonText(value)).toBe(
      '{"outer":{"text":"say \\"hi\\"\\n","count":3,"nothing":null,"list":[1,"two",false],"inner":{"zebra":true,"alpha":"kept"}}}'
    );
  });
});

describe("encodePrettyJsonText", () => {
  it("indents nested values by two spaces and writes non-ASCII text unescaped", () => {
    const value = {
      name: "Caf\u00e9",
      nested: {
        empty: {},
        list: [1, { ok: true }],
      },
    };

    expect(encodePrettyJsonText(value)).toBe(
      [
        "{",
        '  "name": "Caf\u00e9",',
        '  "nested": {',
        '    "empty": {},',
        '    "list": [',
        "      1,",
        "      {",
        '        "ok": true',
        "      }",
        "    ]",
        "  }",
        "}",
      ].join("\n")
    );
  });
});

describe("JsonTextSchema", () => {
  it.effect("fails with a SchemaError when the text is not JSON", () =>
    Effect.gen(function* () {
      const untrusted: unknown = "{not json";
      const failure = yield* Schema.decodeUnknownEffect(JsonTextSchema)(
        untrusted
      ).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(Schema.SchemaError);
    })
  );
});

import { afterEach, describe, expect, it, vi } from "@effect/vitest";
import { parseTypeScriptLiteral } from "@repo/backend/scripts/lib/mdx-parser/literal";
import { Effect, Exit } from "effect";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("typescript");
});

describe("TypeScript literal parser", () => {
  it.effect("parses allowed scalar, array, object, and wrapper syntax", () =>
    Effect.gen(function* () {
      const value = yield* parseTypeScriptLiteral(`({
          title: "Example",
          count: +3,
          delta: -2,
          ready: true,
          disabled: false,
          empty: null,
          tags: ["a", \`b\`, 4],
          "quoted-key": "quoted",
          7: "numeric",
        } as const)`);

      expect(value).toStrictEqual({
        title: "Example",
        count: 3,
        delta: -2,
        ready: true,
        disabled: false,
        empty: null,
        tags: ["a", "b", 4],
        "quoted-key": "quoted",
        7: "numeric",
      });
    })
  );

  it.effect.each([
    ["", "Unsupported literal syntax: Identifier."],
    ["value", "Unsupported literal syntax: Identifier."],
    ["-value", "Only numeric unary literals are supported."],
    ["~1", "Unsupported unary literal operator."],
    ["{ item }", "Only explicit object property assignments are supported."],
    ["{ [item]: 1 }", "Only static object property names are supported."],
  ] as const)("rejects unsupported literal source %s", ([source, message]) =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(parseTypeScriptLiteral(source));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause.toString()).toContain("LiteralParseError");
        expect(exit.cause.toString()).toContain(message);
      }
    })
  );

  it.effect.each([
    {
      isVariableStatement: () => false,
      sourceFile: { statements: [{}] },
    },
    {
      isVariableStatement: () => true,
      sourceFile: {
        statements: [{ declarationList: { declarations: [] } }],
      },
    },
  ])("rejects parser output without an initializer", (typescriptMock) =>
    Effect.gen(function* () {
      yield* Effect.sync(() => {
        vi.resetModules();
        vi.doMock("typescript", () => ({
          ...typescriptMock,
          createSourceFile: () => typescriptMock.sourceFile,
          ScriptKind: { TS: "TS" },
          ScriptTarget: { Latest: "Latest" },
        }));
      });
      const { parseTypeScriptLiteral: parseWithMockedTypescript } =
        yield* Effect.promise(
          () => import("@repo/backend/scripts/lib/mdx-parser/literal")
        );

      const exit = yield* Effect.exit(parseWithMockedTypescript("unused"));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        expect(exit.cause.toString()).toContain("No literal expression found.");
      }
    })
  );
});

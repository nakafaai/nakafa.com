import { parseTypeScriptLiteral } from "@repo/backend/scripts/lib/mdx-parser/literal";
import { Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("typescript");
});

describe("TypeScript literal parser", () => {
  it("parses allowed scalar, array, object, and wrapper syntax", async () => {
    const value = await Effect.runPromise(
      parseTypeScriptLiteral(`({
        title: "Example",
        count: +3,
        delta: -2,
        ready: true,
        disabled: false,
        empty: null,
        tags: ["a", \`b\`, 4],
        "quoted-key": "quoted",
        7: "numeric",
      } as const)`)
    );

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
  });

  it.each([
    ["", "Unsupported literal syntax: Identifier."],
    ["value", "Unsupported literal syntax: Identifier."],
    ["-value", "Only numeric unary literals are supported."],
    ["~1", "Unsupported unary literal operator."],
    ["{ item }", "Only explicit object property assignments are supported."],
    ["{ [item]: 1 }", "Only static object property names are supported."],
  ])("rejects unsupported literal source %s", async (source, message) => {
    const exit = await Effect.runPromiseExit(parseTypeScriptLiteral(source));

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("LiteralParseError");
      expect(exit.cause.toString()).toContain(message);
    }
  });

  it.each([
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
  ])("rejects parser output without an initializer", async (typescriptMock) => {
    vi.resetModules();
    vi.doMock("typescript", () => ({
      ...typescriptMock,
      createSourceFile: () => typescriptMock.sourceFile,
      ScriptKind: { TS: "TS" },
      ScriptTarget: { Latest: "Latest" },
    }));
    const { parseTypeScriptLiteral: parseWithMockedTypescript } = await import(
      "@repo/backend/scripts/lib/mdx-parser/literal"
    );

    const exit = await Effect.runPromiseExit(
      parseWithMockedTypescript("unused")
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      expect(exit.cause.toString()).toContain("No literal expression found.");
    }
  });
});

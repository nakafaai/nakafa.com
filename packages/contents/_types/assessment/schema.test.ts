import {
  AssessmentNodeKeySchema,
  defineAssessment,
} from "@repo/contents/_types/assessment/schema";
import { Either, ParseResult, Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("assessment schema", () => {
  it("rejects invalid assessment node keys through Effect Schema", () => {
    const result = Schema.decodeUnknownEither(AssessmentNodeKeySchema)(
      "Invalid Node"
    );

    expect(Either.isLeft(result)).toBe(true);

    if (Either.isLeft(result)) {
      expect(ParseResult.TreeFormatter.formatErrorSync(result.left)).toContain(
        "Invalid assessment node key."
      );
    }
  });

  it("decodes neutral assessment fixtures without product-looking curriculum data", () => {
    expect(
      defineAssessment({
        nodes: [
          {
            key: "root",
            level: "section",
            materialKeys: [],
            order: 0,
            translations: {
              en: { routeSlug: "root", title: "Root" },
              id: { routeSlug: "root", title: "Root" },
            },
          },
        ],
        programKey: "fixture-program",
      }).nodes[0]?.key
    ).toBe("root");
  });
});

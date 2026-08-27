import {
  createOpenApiEtag,
  NAKAFA_OPENAPI_DOCUMENT,
  NAKAFA_OPENAPI_ETAG,
  NAKAFA_OPENAPI_JSON,
} from "@repo/backend/agent/openapi/document";
import { OPENAPI_RESPONSE_EXAMPLES } from "@repo/backend/agent/openapi/examples";
import {
  NakafaApiHealthSchema,
  NakafaApiIndexSchema,
} from "@repo/contents/_lib/agent/schema/api";
import { NakafaAgentQuranPredecessorSchema } from "@repo/contents/_lib/agent/schema/quran/predecessor";
import { NakafaAgentQuranReferenceSchema } from "@repo/contents/_lib/agent/schema/quran/reference";
import { describe, expect, it } from "@repo/testing/effect";
import { dereference, validate } from "@scalar/openapi-parser";
import { Effect, Predicate, Schema } from "effect";

interface OpenApiOperation {
  readonly description: string;
  readonly operationId: string;
  readonly parameters: readonly unknown[];
  readonly responses: Readonly<Record<string, unknown>>;
}

/** Returns every method operation from the generated path map. */
function readOperations() {
  const operations: OpenApiOperation[] = [];
  for (const pathItem of Object.values(NAKAFA_OPENAPI_DOCUMENT.paths)) {
    for (const operation of Object.values(pathItem)) {
      if (!isOperation(operation)) {
        expect.fail("OpenAPI paths must contain complete operations.");
      }
      operations.push(operation);
    }
  }
  return operations;
}

/** Narrows one generated path value to the required operation surface. */
function isOperation(value: unknown): value is OpenApiOperation {
  return (
    Predicate.isReadonlyObject(value) &&
    typeof value.description === "string" &&
    typeof value.operationId === "string" &&
    Array.isArray(value.parameters) &&
    Predicate.isReadonlyObject(value.responses)
  );
}

/** Projects one OpenAPI operation to a function-calling definition. */
function projectFunction(operation: OpenApiOperation) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const parameter of operation.parameters) {
    if (
      !(
        Predicate.isReadonlyObject(parameter) &&
        typeof parameter.name === "string" &&
        Predicate.isReadonlyObject(parameter.schema)
      )
    ) {
      expect.fail("OpenAPI parameters must be inline and typed.");
    }
    properties[parameter.name] = parameter.schema;
    if (parameter.required === true) {
      required.push(parameter.name);
    }
  }
  return {
    description: operation.description,
    name: operation.operationId,
    parameters: {
      additionalProperties: false,
      properties,
      ...(required.length === 0 ? {} : { required }),
      type: "object",
    },
  };
}

describe("Nakafa OpenAPI document", () => {
  it("derives its ETag from the exact serialized contract bytes", () => {
    expect(NAKAFA_OPENAPI_ETAG).toBe(createOpenApiEtag(NAKAFA_OPENAPI_JSON));
    expect(createOpenApiEtag(`${NAKAFA_OPENAPI_JSON}\n`)).not.toBe(
      NAKAFA_OPENAPI_ETAG
    );
  });

  it.effect("passes the pinned OpenAPI 3.1 parser and validator", () =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise(() =>
        validate(NAKAFA_OPENAPI_JSON)
      );

      expect(
        result.valid,
        result.errors?.map(({ message }) => message).join("\n")
      ).toBe(true);
      expect(result.version).toBe("3.1");
      expect(result.errors ?? []).toEqual([]);
    })
  );

  it("resolves every schema without external or recursive references", () => {
    const result = dereference(NAKAFA_OPENAPI_DOCUMENT);
    const serialized = JSON.stringify(result.schema);

    expect(result.errors ?? []).toEqual([]);
    expect(result.schema).toBeDefined();
    expect(serialized).not.toContain('"$ref"');
  });

  it("uses unique described operations, typed parameters, and examples", () => {
    const operations = readOperations();
    const operationIds = operations.map(({ operationId }) => operationId);

    expect(new Set(operationIds).size).toBe(operationIds.length);
    for (const operation of operations) {
      expect(operation.description.length).toBeGreaterThan(20);
      expect(operation.responses["200"]).toMatchObject({
        content: {
          "application/json": {
            example: expect.any(Object),
            schema: expect.any(Object),
          },
        },
        description: expect.any(String),
      });
      for (const parameter of operation.parameters) {
        expect(parameter).toMatchObject({
          description: expect.any(String),
          example: expect.anything(),
          name: expect.any(String),
          schema: expect.any(Object),
        });
        expect(JSON.stringify(parameter)).not.toContain('"type":"null"');
      }
    }
  });

  it("documents semantic Quran translation notes without raw markers", () => {
    const verse = OPENAPI_RESPONSE_EXAMPLES.QuranReference.verses[0];

    expect(verse).toEqual({
      arabic: "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ",
      number: 1,
      translation: {
        notes: [
          {
            number: 1,
            referenceOffset: 47,
            text: "Exact source-authored explanatory note.",
          },
        ],
        segments: [
          {
            kind: "text",
            offset: 0,
            value: "In the name of Allah, the Most Compassionate. ",
          },
          { kind: "note", number: 1, offset: 47 },
        ],
      },
    });
    expect(JSON.stringify(verse)).not.toContain('"translation":"');
  });

  it("keeps the predecessor exact and derives the canonical example", () => {
    expect(
      Schema.is(NakafaApiIndexSchema)(OPENAPI_RESPONSE_EXAMPLES.ApiIndex)
    ).toBe(true);
    expect(
      Schema.is(NakafaApiHealthSchema)(OPENAPI_RESPONSE_EXAMPLES.ApiHealth)
    ).toBe(true);
    expect(
      Schema.is(NakafaAgentQuranPredecessorSchema)(
        OPENAPI_RESPONSE_EXAMPLES.QuranPredecessor
      )
    ).toBe(true);
    expect(
      Schema.is(NakafaAgentQuranReferenceSchema)(
        OPENAPI_RESPONSE_EXAMPLES.QuranReference
      )
    ).toBe(true);
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/quran/{surah}");
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/v1");
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/v1/content");
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/v1/health");
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/v1/quran/{surah}");
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/v1/search");
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/v1/taxonomy");
    expect(NAKAFA_OPENAPI_DOCUMENT.paths).toHaveProperty("/v2/quran/{surah}");
  });

  it("projects every operation to a non-recursive function definition", () => {
    const functions = readOperations().map(projectFunction);

    expect(functions.map(({ name }) => name)).toEqual([
      "getNakafaOpenApi",
      "getNakafaQuranReference",
      "getNakafaApiIndex",
      "getNakafaContent",
      "getNakafaApiHealth",
      "getNakafaQuranPredecessor",
      "searchNakafaContent",
      "getNakafaTaxonomy",
      "getNakafaQuranReferenceCompatibility",
    ]);
    for (const definition of functions) {
      expect(definition.parameters).toMatchObject({
        additionalProperties: false,
        properties: expect.any(Object),
        type: "object",
      });
      expect(JSON.stringify(definition)).not.toContain("$ref");
    }
  });

  it("documents the real edge and application rate-limit contracts", () => {
    const operations = readOperations();
    const metered = new Set([
      "getNakafaContent",
      "getNakafaQuranReference",
      "getNakafaQuranPredecessor",
      "getNakafaQuranReferenceCompatibility",
      "searchNakafaContent",
      "getNakafaTaxonomy",
    ]);

    expect(NAKAFA_OPENAPI_DOCUMENT.security).toEqual([]);
    expect(NAKAFA_OPENAPI_DOCUMENT.components.securitySchemes).toEqual({});
    for (const operation of operations) {
      expect(operation.responses).toHaveProperty("403");
      if (metered.has(operation.operationId)) {
        expect(operation.responses["429"]).toMatchObject({
          headers: { "Retry-After": { schema: { type: "string" } } },
        });
      } else {
        expect(operation.responses).not.toHaveProperty("429");
      }
    }
  });
});

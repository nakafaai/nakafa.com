import {
  createOpenApiEtag,
  NAKAFA_OPENAPI_DOCUMENT,
  NAKAFA_OPENAPI_ETAG,
  NAKAFA_OPENAPI_JSON,
} from "@repo/backend/agent/openapi/document";
import { dereference, validate } from "@scalar/openapi-parser";
import { describe, expect, it } from "vitest";

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
        throw new Error("OpenAPI paths must contain complete operations.");
      }
      operations.push(operation);
    }
  }
  return operations;
}

/** Narrows one generated path value to the required operation surface. */
function isOperation(value: unknown): value is OpenApiOperation {
  return (
    isObject(value) &&
    typeof value.description === "string" &&
    typeof value.operationId === "string" &&
    Array.isArray(value.parameters) &&
    isObject(value.responses)
  );
}

/** Projects an OpenAPI operation to a function-calling definition. */
function projectFunction(operation: OpenApiOperation) {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const parameter of operation.parameters) {
    if (!(isObject(parameter) && typeof parameter.name === "string")) {
      throw new Error("OpenAPI operations must use inline typed parameters.");
    }
    if (!isObject(parameter.schema)) {
      throw new Error(`Parameter ${parameter.name} must have a schema.`);
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

/** Narrows non-array object values used by the test traversal. */
function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("Nakafa OpenAPI document", () => {
  it("derives its ETag from the exact serialized contract bytes", () => {
    expect(NAKAFA_OPENAPI_ETAG).toBe(createOpenApiEtag(NAKAFA_OPENAPI_JSON));
    expect(createOpenApiEtag(`${NAKAFA_OPENAPI_JSON}\n`)).not.toBe(
      NAKAFA_OPENAPI_ETAG
    );
  });

  it("passes a current OpenAPI 3.1 parser and validator", async () => {
    const result = await validate(NAKAFA_OPENAPI_JSON);

    expect(
      result.valid,
      result.errors?.map(({ message }) => message).join("\n")
    ).toBe(true);
    expect(result.version).toBe("3.1");
    expect(result.errors ?? []).toEqual([]);
  });

  it("resolves every response schema without external or recursive references", () => {
    const result = dereference(NAKAFA_OPENAPI_DOCUMENT);
    const serialized = JSON.stringify(result.schema);

    expect(result.errors ?? []).toEqual([]);
    expect(result.schema).toBeDefined();
    expect(serialized).not.toContain('"$ref"');
  });

  it("uses unique described operation IDs, typed parameters, and examples", () => {
    const operations = readOperations();
    const operationIds = operations.map(({ operationId }) => operationId);

    expect(new Set(operationIds).size).toBe(operationIds.length);
    for (const operation of operations) {
      expect(operation.description.length).toBeGreaterThan(20);
      expect(Object.keys(operation.responses)).toContain("200");
      const success = operation.responses["200"];
      expect(success).toMatchObject({
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

  it("projects every operation to a non-recursive function definition", () => {
    const functions = readOperations().map(projectFunction);

    expect(functions.map(({ name }) => name)).toEqual([
      "getNakafaOpenApi",
      "getNakafaApiIndex",
      "getNakafaContent",
      "getNakafaApiHealth",
      "getNakafaQuranReference",
      "searchNakafaContent",
      "getNakafaTaxonomy",
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

  it("documents no authentication and explicit version and deprecation policies", () => {
    expect(NAKAFA_OPENAPI_DOCUMENT.security).toEqual([]);
    expect(NAKAFA_OPENAPI_DOCUMENT.components.securitySchemes).toEqual({});
    expect(NAKAFA_OPENAPI_DOCUMENT.info).toMatchObject({
      contact: {
        email: "nakafaai@gmail.com",
        url: "https://nakafa.com/contact",
      },
      "x-deprecation-policy": {
        headers: ["Deprecation", "Link", "Sunset"],
        minimum_notice_days: 90,
      },
      "x-version-policy": expect.stringContaining(
        "Breaking changes require v2"
      ),
    });
  });

  it("documents the platform-owned rate-limit response without promising Problem Details", () => {
    const [openApiOperation, ...protectedOperations] = readOperations();

    expect(openApiOperation?.operationId).toBe("getNakafaOpenApi");
    expect(openApiOperation?.responses).toMatchObject({
      "304": {
        headers: { ETag: { schema: { type: "string" } } },
      },
    });
    expect(openApiOperation?.responses).not.toHaveProperty("403");
    expect(openApiOperation?.responses).not.toHaveProperty("429");

    for (const operation of protectedOperations) {
      expect(operation.responses["429"]).toMatchObject({
        description: expect.stringContaining("Vercel Firewall"),
        headers: {
          "Retry-After": { schema: { type: "string" } },
        },
      });
      expect(operation.responses["429"]).not.toHaveProperty("content");
    }
  });
});

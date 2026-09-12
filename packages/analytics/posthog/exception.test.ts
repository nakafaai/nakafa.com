import { describe, expect, it } from "@effect/vitest";
import {
  createOperationalException,
  decodeOperationalExceptionProperties,
  operationalExceptionDiscriminators,
} from "@repo/analytics/posthog/exception";
import { Option } from "effect";

describe("operational exception privacy", () => {
  it("keeps the error name while removing messages and retaining frames", () => {
    const input = new TypeError("secret user@example.com");
    input.stack = [
      "TypeError: secret user@example.com",
      "    at submit (/app/chunk.js:10:5)",
    ].join("\n");

    const operational = createOperationalException(input);

    expect(operational.name).toBe("TypeError");
    expect(operational.message).toBe("Operational exception");
    expect(operational.stack).toBe(
      "TypeError: Operational exception\n    at submit (/app/chunk.js:10:5)"
    );
    expect(JSON.stringify(operational)).not.toContain("user@example.com");
  });

  it("falls back to the operational name when the error has none", () => {
    const input = new Error("secret user@example.com");
    input.name = "";
    input.stack = "Error: secret\n    at run (/app/chunk.js:1:1)";

    const operational = createOperationalException(input);

    expect(operational.name).toBe("OperationalError");
    expect(operational.stack).toBe(
      "OperationalError: Operational exception\n    at run (/app/chunk.js:1:1)"
    );
    expect(operationalExceptionDiscriminators(input)).toEqual({});
  });

  it("does not serialize arbitrary non-error payloads", () => {
    const operational = createOperationalException({
      message: "secret user@example.com",
    });

    expect(operational).toMatchObject({
      message: "Operational exception",
      name: "OperationalError",
    });
    expect(JSON.stringify(operational)).not.toContain("user@example.com");
  });

  it("extracts a bounded name and code without the message", () => {
    const error = new TypeError("secret user@example.com");
    (error as { code?: unknown }).code = " ERR_PARSE ";

    const discriminators = operationalExceptionDiscriminators(error);

    expect(discriminators).toEqual({
      error_code: "ERR_PARSE",
      error_name: "TypeError",
    });
    expect(JSON.stringify(discriminators)).not.toContain("user@example.com");
  });

  it("keeps only string codes with content", () => {
    expect(operationalExceptionDiscriminators({ message: "secret" })).toEqual(
      {}
    );
    expect(operationalExceptionDiscriminators({ code: 500 })).toEqual({});
    expect(operationalExceptionDiscriminators({ code: "   " })).toEqual({});
  });

  it("accepts only exact bounded operational context", () => {
    expect(
      Option.getOrUndefined(
        decodeOperationalExceptionProperties({
          error_code: "ERR_PARSE",
          error_name: "TypeError",
          model_id: "nakafa-lite",
          source: "chat-api",
        })
      )
    ).toEqual({
      error_code: "ERR_PARSE",
      error_name: "TypeError",
      model_id: "nakafa-lite",
      source: "chat-api",
    });
    expect(
      Option.isNone(
        decodeOperationalExceptionProperties({
          source: "chat-api",
          userId: "user-1",
        })
      )
    ).toBe(true);
    expect(
      Option.isNone(
        decodeOperationalExceptionProperties({ source: "x".repeat(129) })
      )
    ).toBe(true);
  });
});

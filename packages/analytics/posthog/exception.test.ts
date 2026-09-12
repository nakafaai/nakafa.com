import { describe, expect, it } from "@effect/vitest";
import {
  createOperationalException,
  decodeOperationalExceptionProperties,
} from "@repo/analytics/posthog/exception";
import { Option } from "effect";

describe("operational exception privacy", () => {
  it("removes messages and retains stack frames", () => {
    const input = new Error("secret user@example.com");
    input.stack = [
      "Error: secret user@example.com",
      "    at submit (/app/chunk.js:10:5)",
    ].join("\n");

    const operational = createOperationalException(input, {
      source: "chat-api",
    });

    expect(operational.name).toBe("OperationalError(chat-api)");
    expect(operational.message).toBe("Operational exception");
    expect(operational.stack).toBe(
      "OperationalError(chat-api): Operational exception\n    at submit (/app/chunk.js:10:5)"
    );
    expect(JSON.stringify(operational)).not.toContain("user@example.com");
  });

  it("does not serialize arbitrary non-error payloads", () => {
    const operational = createOperationalException(
      { message: "secret user@example.com" },
      { source: "chat-api" }
    );

    expect(operational).toMatchObject({
      message: "Operational exception",
      name: "OperationalError(chat-api)",
    });
    expect(JSON.stringify(operational)).not.toContain("user@example.com");
  });

  it("names the exception after its origin so grouping is stable", () => {
    expect(
      createOperationalException(new Error("boom"), {
        source: "next-on-request-error",
      }).name
    ).toBe("OperationalError(next-on-request-error)");
    expect(
      createOperationalException(new Error("boom"), {
        operation: "save-message",
        source: "chat-api",
      }).name
    ).toBe("OperationalError(chat-api.save-message)");
    expect(
      createOperationalException(new Error("boom"), {
        error_location: "saveTitle",
        source: "chat-api",
      }).name
    ).toBe("OperationalError(chat-api.saveTitle)");
  });

  it("accepts only exact bounded operational context", () => {
    expect(
      Option.getOrUndefined(
        decodeOperationalExceptionProperties({
          model_id: "nakafa-lite",
          source: "chat-api",
        })
      )
    ).toEqual({ model_id: "nakafa-lite", source: "chat-api" });
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

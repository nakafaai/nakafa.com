import {
  createOperationalException,
  decodeOperationalExceptionProperties,
} from "@repo/analytics/posthog/exception";
import { describe, expect, it } from "@repo/testing/effect";
import { Option } from "effect";

describe("operational exception privacy", () => {
  it("removes messages and retains stack frames", () => {
    const input = new Error("secret user@example.com");
    input.stack = [
      "Error: secret user@example.com",
      "    at submit (/app/chunk.js:10:5)",
    ].join("\n");

    const operational = createOperationalException(input);

    expect(operational.name).toBe("OperationalError");
    expect(operational.message).toBe("Operational exception");
    expect(operational.stack).toBe(
      "OperationalError: Operational exception\n    at submit (/app/chunk.js:10:5)"
    );
    expect(JSON.stringify(operational)).not.toContain("user@example.com");
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

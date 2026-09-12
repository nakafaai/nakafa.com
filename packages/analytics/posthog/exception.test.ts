import { describe, expect, it } from "@effect/vitest";
import {
  createOperationalException,
  createOperationalExceptionMetadata,
  decodeOperationalExceptionProperties,
} from "@repo/analytics/posthog/exception";
import { Option } from "effect";

describe("operational exception privacy", () => {
  it("removes messages while retaining stack frames and the error class", () => {
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

  it("drops a message-shaped error name back to the constant", () => {
    const input = new Error("boom");
    input.name = "secret user@example.com";

    const operational = createOperationalException(input);

    expect(operational.name).toBe("OperationalError");
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

describe("operational exception grouping", () => {
  it("derives a fingerprint and title from the error class and context", () => {
    const metadata = createOperationalExceptionMetadata("TypeError", {
      error_digest: "digest-1",
      render_source: "server",
      route_path: "/[locale]/materials/[...slug]",
      source: "next-on-request-error",
    });

    expect(metadata).toEqual({
      $exception_fingerprint:
        "TypeError|source:next-on-request-error|route_path:/[locale]/materials/[...slug]|render_source:server|error_digest:digest-1",
      $issue_name:
        "TypeError · next-on-request-error · /[locale]/materials/[...slug]",
      error_name: "TypeError",
    });
  });

  it("groups the same fault identically regardless of minified frames", () => {
    const first = new Error("first build message");
    first.stack = "Error: first\n    at a (/_next/chunk.abc.js:1:1)";
    const second = new Error("second build message");
    second.stack = "Error: second\n    at b (/_next/chunk.xyz.js:2:2)";
    const properties = { source: "sitemap-id" } as const;

    expect(
      createOperationalExceptionMetadata(
        createOperationalException(first).name,
        properties
      ).$exception_fingerprint
    ).toBe(
      createOperationalExceptionMetadata(
        createOperationalException(second).name,
        properties
      ).$exception_fingerprint
    );
  });

  it("groups client boundary faults by their Next.js digest", () => {
    const metadata = createOperationalExceptionMetadata("Error", {
      nextjs_digest: "3210922105",
      source: "next-global-error",
    });

    expect(metadata.$exception_fingerprint).toBe(
      "Error|source:next-global-error|nextjs_digest:3210922105"
    );
    expect(metadata.$issue_name).toBe("Error · next-global-error");
  });

  it("keeps the constant class for non-error payloads", () => {
    const exception = createOperationalException({ message: "secret" });
    const metadata = createOperationalExceptionMetadata(exception.name, {
      source: "chat-api",
    });

    expect(metadata.error_name).toBe("OperationalError");
    expect(metadata.$exception_fingerprint).toBe(
      "OperationalError|source:chat-api"
    );
  });
});

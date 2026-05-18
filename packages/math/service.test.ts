import { MathCasRequestError } from "@repo/math/errors";
import { MathService } from "@repo/math/service";
import { ConfigProvider, Effect, Exit } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

const provider = ConfigProvider.fromMap(
  new Map([
    ["MATH_CAS_API_KEY", "secret"],
    ["NEXT_PUBLIC_CAS_URL", "https://cas.nakafa.test"],
  ])
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MathService", () => {
  it("calls the configured CAS endpoint and decodes the result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        conditions: [],
        input: {
          expression: "6 * 7",
          kind: "math",
          operation: "evaluate",
        },
        items: [],
        kind: "evaluate",
        operation: "evaluate",
        primary: {
          expression: "6 * 7",
          latex: "6 \\cdot 7",
        },
        reason: "Exact arithmetic was checked.",
        secondary: {
          expression: "42",
          latex: "42",
        },
        stepStatus: "complete",
        steps: [
          {
            action: "evaluate",
            items: [],
            primary: {
              expression: "6 * 7",
              latex: "6 \\cdot 7",
            },
            relation: {
              expression: "equals",
              latex: "=",
            },
            secondary: {
              expression: "42",
              latex: "42",
            },
          },
        ],
        status: "verified",
      })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "6 * 7",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      return;
    }

    expect(exit.value.secondary?.expression).toBe("42");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      new URL("/api/math", "https://cas.nakafa.test"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer secret",
        }),
      })
    );
  });

  it("keeps CAS HTTP failures typed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("bad request", { status: 422 })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "x +",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(MathCasRequestError.name);
  });

  it("keeps CAS JSON error details readable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ detail: "Invalid expression." }, { status: 422 })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "x +",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain("Invalid expression.");
  });

  it("keeps CAS validation issues readable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          detail: [{ msg: "Expression is required." }],
        },
        { status: 422 }
      )
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain("Expression is required.");
  });

  it("uses a status message when CAS returns malformed JSON errors", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("{", {
        headers: { "content-type": "application/json" },
        status: 500,
      })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(
      "Math request failed with status 500."
    );
  });

  it("does not leak HTML error pages into math evidence", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<!DOCTYPE html><html><body>404</body></html>", {
        headers: { "content-type": "text/html; charset=utf-8" },
        status: 404,
      })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(
      "Math request failed with status 404."
    );
    expect(exit.cause.toString()).not.toContain("<!DOCTYPE html>");
  });

  it("keeps network failures typed", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(
      "Unable to reach the Nakafa math service."
    );
  });

  it("keeps unreadable JSON responses typed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not-json"));

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(
      "Math service returned an unreadable JSON response."
    );
  });

  it("keeps invalid CAS payloads typed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({ status: "verified" })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain("MathCasResponseError");
  });

  it("uses a status message when CAS returns an empty error body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 500 })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(
      "Math request failed with status 500."
    );
  });

  it("uses a status message when the CAS error body cannot be read", async () => {
    class BrokenTextResponse extends Response {
      override text() {
        return Promise.reject(new Error("broken body"));
      }
    }

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new BrokenTextResponse("", { status: 500 })
    );

    const exit = await Effect.runPromiseExit(
      MathService.compute({
        expression: "2 + 2",
        kind: "math",
        operation: "evaluate",
      }).pipe(
        Effect.provide(MathService.Default),
        Effect.withConfigProvider(provider)
      )
    );

    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isSuccess(exit)) {
      return;
    }

    expect(exit.cause.toString()).toContain(
      "Math request failed with status 500."
    );
  });
});

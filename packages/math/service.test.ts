import { MathCasRequestError } from "@repo/math/errors";
import { MathService } from "@repo/math/service";
import { afterEach, describe, expect, it, vi } from "@repo/testing/effect";
import { ConfigProvider, Effect, Exit } from "effect";

const provider = ConfigProvider.fromEnvRecord({
  MATH_CAS_API_KEY: "secret",
  NEXT_PUBLIC_CAS_URL: "https://cas.nakafa.test",
});
afterEach(() => {
  vi.restoreAllMocks();
});
describe("MathService", () => {
  it.effect("calls the configured CAS endpoint and decodes the result", () =>
    Effect.gen(function* () {
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
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "6 * 7",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
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
    })
  );
  it.effect("keeps CAS HTTP failures typed", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("bad request", { status: 422 })
      );
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "x +",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        return;
      }
      expect(exit.cause.toString()).toContain(MathCasRequestError.name);
    })
  );
  it.effect("keeps CAS JSON error details readable", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json({ detail: "Invalid expression." }, { status: 422 })
      );
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "x +",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        return;
      }
      expect(exit.cause.toString()).toContain("Invalid expression.");
    })
  );
  it.effect("keeps CAS validation issues readable", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json(
          {
            detail: [{ msg: "Expression is required." }],
          },
          { status: 422 }
        )
      );
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        return;
      }
      expect(exit.cause.toString()).toContain("Expression is required.");
    })
  );
  it.effect(
    "uses a status message when CAS returns malformed JSON errors",
    () =>
      Effect.gen(function* () {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response("{", {
            headers: { "content-type": "application/json" },
            status: 500,
          })
        );
        const exit = yield* Effect.exit(
          MathService.use((service) =>
            service.compute({
              expression: "2 + 2",
              kind: "math",
              operation: "evaluate",
            })
          ).pipe(
            Effect.provide(MathService.layer),
            Effect.provideService(ConfigProvider.ConfigProvider, provider)
          )
        );
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isSuccess(exit)) {
          return;
        }
        expect(exit.cause.toString()).toContain(
          "Math request failed with status 500."
        );
      })
  );
  it.effect("does not leak HTML error pages into math evidence", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("<!DOCTYPE html><html><body>404</body></html>", {
          headers: { "content-type": "text/html; charset=utf-8" },
          status: 404,
        })
      );
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "2 + 2",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
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
    })
  );
  it.effect("keeps network failures typed", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "2 + 2",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        return;
      }
      expect(exit.cause.toString()).toContain(
        "Unable to reach the Nakafa math service."
      );
    })
  );
  it.effect("keeps unreadable JSON responses typed", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("not-json"));
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "2 + 2",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        return;
      }
      expect(exit.cause.toString()).toContain(
        "Math service returned an unreadable JSON response."
      );
    })
  );
  it.effect("keeps invalid CAS payloads typed", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json({ status: "verified" })
      );
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "2 + 2",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        return;
      }
      expect(exit.cause.toString()).toContain("MathCasResponseError");
    })
  );
  it.effect("uses a status message when CAS returns an empty error body", () =>
    Effect.gen(function* () {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", { status: 500 })
      );
      const exit = yield* Effect.exit(
        MathService.use((service) =>
          service.compute({
            expression: "2 + 2",
            kind: "math",
            operation: "evaluate",
          })
        ).pipe(
          Effect.provide(MathService.layer),
          Effect.provideService(ConfigProvider.ConfigProvider, provider)
        )
      );
      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isSuccess(exit)) {
        return;
      }
      expect(exit.cause.toString()).toContain(
        "Math request failed with status 500."
      );
    })
  );
  it.effect(
    "uses a status message when the CAS error body cannot be read",
    () =>
      Effect.gen(function* () {
        class BrokenTextResponse extends Response {
          override text() {
            return Promise.reject(new Error("broken body"));
          }
        }
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new BrokenTextResponse("", { status: 500 })
        );
        const exit = yield* Effect.exit(
          MathService.use((service) =>
            service.compute({
              expression: "2 + 2",
              kind: "math",
              operation: "evaluate",
            })
          ).pipe(
            Effect.provide(MathService.layer),
            Effect.provideService(ConfigProvider.ConfigProvider, provider)
          )
        );
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isSuccess(exit)) {
          return;
        }
        expect(exit.cause.toString()).toContain(
          "Math request failed with status 500."
        );
      })
  );
});

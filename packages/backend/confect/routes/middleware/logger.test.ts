import { expect, it } from "@effect/vitest";
import { requestLogger } from "@repo/backend/confect/routes/middleware/logger";
import { Array as Arr, Effect, Layer, Logger } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";

it.effect("logs request paths without OAuth query diagnostics", () =>
  Effect.gen(function* () {
    let messages: string[] = [];
    const capture = Logger.map(Logger.formatStructured, (entry) => {
      messages = Arr.append(messages, JSON.stringify(entry));
    });
    const routes = HttpRouter.add(
      "GET",
      "/api/auth/callback/google",
      HttpServerResponse.text("Accepted", { status: 202 })
    ).pipe(
      Layer.provide(requestLogger.layer),
      Layer.provideMerge(Logger.layer([capture]))
    );
    const response = yield* Effect.acquireUseRelease(
      Effect.sync(() =>
        HttpRouter.toWebHandler(routes, { disableLogger: true })
      ),
      ({ handler }) =>
        Effect.promise(() =>
          handler(
            new Request(
              "http://localhost/api/auth/callback/google?error=access_denied&error_description=private+provider+diagnostic&state=private-state"
            )
          )
        ),
      ({ dispose }) => Effect.promise(dispose)
    );
    expect(response.status).toBe(202);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toContain('"path":"/api/auth/callback/google"');
    expect(messages[0]).toContain('"status":202');
    for (const secret of [
      "access_denied",
      "error_description",
      "private+provider+diagnostic",
      "state=",
      "private-state",
    ]) {
      expect(Arr.join(messages, "\n")).not.toContain(secret);
    }
  })
);

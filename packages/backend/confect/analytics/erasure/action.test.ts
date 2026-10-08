import { describe, expect, it } from "@effect/vitest";
import {
  ensurePostHogErasureConfigured,
  erasePostHogPerson,
} from "@repo/backend/confect/analytics/erasure/action";
import {
  PostHogErasureConfigError,
  PostHogErasureRequestError,
} from "@repo/backend/confect/analytics/erasure/action.spec";
import { ConfigProvider, Effect, Fiber, Schema } from "effect";
import { TestClock } from "effect/testing";

const config = {
  deletionApiKey: "phx_test",
  host: "https://eu.i.posthog.com",
  projectId: "114144",
};
const JsonText = Schema.fromJsonString(Schema.Unknown);
describe("analytics erasure action", () => {
  it.effect.each([
    "POSTHOG_ERASURE_API_KEY",
    "POSTHOG_HOST",
    "POSTHOG_PROJECT_ID",
  ])("fails in the typed channel when %s is not configured", (missing) =>
    Effect.gen(function* () {
      const provider = ConfigProvider.fromUnknown({
        POSTHOG_ERASURE_API_KEY: "phx_private_test",
        POSTHOG_HOST: config.host,
        POSTHOG_PROJECT_ID: config.projectId,
        [missing]: undefined,
      });
      for (const program of [
        ensurePostHogErasureConfigured(),
        erasePostHogPerson("user-1"),
      ]) {
        const failure = yield* program.pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, provider),
          Effect.flip
        );
        expect(failure).toBeInstanceOf(PostHogErasureConfigError);
        const serializedFailure = yield* Schema.encodeEffect(JsonText)(
          failure
        ).pipe(Effect.orDie);
        expect(serializedFailure).not.toContain("phx_private_test");
      }
    })
  );
  it.effect(
    "validates configured settings at the deletion readiness boundary",
    () =>
      ensurePostHogErasureConfigured().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromUnknown({
            POSTHOG_ERASURE_API_KEY: config.deletionApiKey,
            POSTHOG_HOST: config.host,
            POSTHOG_PROJECT_ID: config.projectId,
          })
        )
      )
  );
  it.effect("sends through the global fetch when no request is injected", () =>
    Effect.gen(function* () {
      const fetcher = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(
            Schema.encodeSync(JsonText)({
              deletion_errors: [],
              events_queued_for_deletion: true,
              persons_deleted: 1,
              persons_found: 1,
              recordings_queued_for_deletion: true,
            }),
            { status: 202 }
          )
        )
      );
      vi.stubGlobal("fetch", fetcher);
      const provider = ConfigProvider.fromUnknown({
        POSTHOG_ERASURE_API_KEY: config.deletionApiKey,
        POSTHOG_HOST: config.host,
        POSTHOG_PROJECT_ID: config.projectId,
      });

      yield* erasePostHogPerson("user-1").pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );

      expect(fetcher).toHaveBeenCalledWith(
        "https://eu.posthog.com/api/projects/114144/persons/bulk_delete/",
        expect.objectContaining({ method: "POST" })
      );
    }).pipe(Effect.ensuring(Effect.sync(() => vi.unstubAllGlobals())))
  );
  it.effect("requests person, event, and recording erasure", () =>
    Effect.gen(function* () {
      const request = vi.fn(() =>
        Promise.resolve(
          new Response(
            Schema.encodeSync(JsonText)({
              deletion_errors: [],
              events_queued_for_deletion: true,
              persons_deleted: 1,
              persons_found: 1,
              recordings_queued_for_deletion: true,
            }),
            {
              status: 202,
            }
          )
        )
      );
      yield* erasePostHogPerson("user-1", {
        config,
        request,
      });
      const body = yield* Schema.encodeEffect(JsonText)({
        delete_events: true,
        delete_recordings: true,
        distinct_ids: ["user-1"],
        keep_person: false,
      }).pipe(Effect.orDie);
      expect(request).toHaveBeenCalledWith(
        "https://eu.posthog.com/api/projects/114144/persons/bulk_delete/",
        {
          body,
          headers: {
            Authorization: "Bearer phx_test",
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: expect.any(AbortSignal),
        }
      );
    })
  );
  it.effect(
    "accepts an idempotent retry after the person is already absent",
    () =>
      Effect.gen(function* () {
        const request = vi.fn(() =>
          Promise.resolve(
            new Response(
              Schema.encodeSync(JsonText)({
                events_queued_for_deletion: false,
                persons_deleted: 0,
                persons_found: 0,
                recordings_queued_for_deletion: false,
              }),
              {
                status: 202,
              }
            )
          )
        );
        expect(
          yield* erasePostHogPerson("user-1", {
            config,
            request,
          })
        ).toBeUndefined();
      })
  );
  it.effect("returns a typed failure when credentials are missing", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config: {
          ...config,
          deletionApiKey: "",
        },
        request: fetch,
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PostHogErasureConfigError);
    })
  );
  it.effect(
    "rejects account deletion before auth removal without credentials",
    () =>
      Effect.gen(function* () {
        const failure = yield* ensurePostHogErasureConfigured({
          ...config,
          deletionApiKey: " ",
        }).pipe(Effect.flip);
        expect(failure).toBeInstanceOf(PostHogErasureConfigError);
      })
  );
  it.effect(
    "rejects a non-numeric PostHog project id before auth removal",
    () =>
      Effect.gen(function* () {
        const failure = yield* ensurePostHogErasureConfigured({
          ...config,
          projectId: "not-a-project-id",
        }).pipe(Effect.flip);
        expect(failure).toBeInstanceOf(PostHogErasureConfigError);
      })
  );
  it.effect("returns a typed failure for an invalid host", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config: {
          ...config,
          host: "not a URL",
        },
        request: fetch,
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PostHogErasureConfigError);
    })
  );
  it.effect("never sends the deletion credential outside PostHog", () =>
    Effect.gen(function* () {
      const request = vi.fn<typeof fetch>();
      const failure = yield* erasePostHogPerson("user-1", {
        config: {
          ...config,
          host: "https://eu.i.posthog.com.example.com",
        },
        request,
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PostHogErasureConfigError);
      expect(request).not.toHaveBeenCalled();
    })
  );
  it.effect("returns a typed failure when the request cannot be sent", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: () => Promise.reject(new Error("offline")),
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
    })
  );
  it.effect("aborts a request that misses its 10 second deadline", () =>
    Effect.gen(function* () {
      const request = vi.fn<typeof fetch>(
        () => new Promise<Response>(() => undefined)
      );
      const fiber = yield* Effect.forkChild(
        erasePostHogPerson("user-1", { config, request }).pipe(Effect.flip)
      );

      yield* TestClock.adjust("9999 millis");
      const signal = request.mock.calls[0]?.[1]?.signal;
      expect(signal?.aborted).toBe(false);
      yield* TestClock.adjust("1 millis");

      const failure = yield* Fiber.join(fiber);
      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe("PostHog person erasure request timed out.");
      expect(signal?.aborted).toBe(true);
      expect(request).toHaveBeenCalledOnce();
    })
  );
  it.effect("returns a typed failure when the answer body cannot be read", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: () =>
          Promise.resolve(
            new Response(
              new ReadableStream<Uint8Array>({
                /** Fails before the answer body yields any bytes. */
                pull(controller) {
                  controller.error(new Error("unreadable"));
                },
              }),
              { status: 202 }
            )
          ),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe(
        "PostHog person erasure returned an invalid response."
      );
    })
  );
  it.effect("aborts an answer whose body stalls past the deadline", () =>
    Effect.gen(function* () {
      const request = vi.fn<typeof fetch>(() =>
        Promise.resolve(
          new Response(new ReadableStream<Uint8Array>(), { status: 202 })
        )
      );
      const fiber = yield* Effect.forkChild(
        erasePostHogPerson("user-1", { config, request }).pipe(Effect.flip)
      );

      yield* TestClock.adjust("10 seconds");

      const failure = yield* Fiber.join(fiber);
      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe("PostHog person erasure request timed out.");
      expect(request.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    })
  );
  it.effect("returns a typed failure when PostHog rejects erasure", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: () =>
          Promise.resolve(
            new Response(null, {
              status: 403,
            })
          ),
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe("PostHog person erasure returned HTTP 403.");
    })
  );
  it.effect.each([null, "{}"])(
    "returns a typed failure for an invalid success response %s",
    (body) =>
      Effect.gen(function* () {
        const failure = yield* erasePostHogPerson("user-1", {
          config,
          request: () =>
            Promise.resolve(
              new Response(body, {
                status: 202,
              })
            ),
        }).pipe(Effect.flip);
        expect(failure).toBeInstanceOf(PostHogErasureRequestError);
        expect(failure.message).toBe(
          "PostHog person erasure returned an invalid response."
        );
      })
  );
  it.effect("retries when PostHog reports a partial erasure failure", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: () =>
          Promise.resolve(
            new Response(
              Schema.encodeSync(JsonText)({
                deletion_errors: [
                  {
                    person_uuid: "person-1",
                  },
                ],
                events_queued_for_deletion: false,
                persons_deleted: 0,
                persons_found: 1,
                recordings_queued_for_deletion: false,
              }),
              {
                status: 202,
              }
            )
          ),
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe(
        "PostHog did not accept complete analytics erasure."
      );
    })
  );
  it.effect.each([
    {
      events_queued_for_deletion: false,
      persons_deleted: 1,
      persons_found: 1,
      recordings_queued_for_deletion: true,
    },
    {
      events_queued_for_deletion: true,
      persons_deleted: 1,
      persons_found: 1,
      recordings_queued_for_deletion: false,
    },
    {
      events_queued_for_deletion: true,
      persons_deleted: 0,
      persons_found: 1,
      recordings_queued_for_deletion: true,
    },
  ])("retries an incomplete accepted response", (result) =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: () =>
          Promise.resolve(
            new Response(
              Schema.encodeSync(JsonText)({
                deletion_errors: [],
                ...result,
              }),
              {
                status: 202,
              }
            )
          ),
      }).pipe(Effect.flip);
      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe(
        "PostHog did not accept complete analytics erasure."
      );
    })
  );
});

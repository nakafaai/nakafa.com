import {
  ensurePostHogErasureConfigured,
  erasePostHogPerson,
  PostHogErasureConfigError,
  PostHogErasureRequestError,
} from "@repo/backend/convex/analytics/erasure/action";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect } from "effect";
import { vi } from "vitest";

const config = {
  deletionApiKey: "phx_test",
  host: "https://eu.i.posthog.com",
  projectId: "114144",
};

describe("analytics erasure action", () => {
  it.live("requests person, event, and recording erasure", () =>
    Effect.gen(function* () {
      const request = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              deletion_errors: [],
              events_queued_for_deletion: true,
              persons_deleted: 1,
              persons_found: 1,
              recordings_queued_for_deletion: true,
            }),
            { status: 202 }
          )
      );

      yield* erasePostHogPerson("user-1", { config, request });

      expect(request).toHaveBeenCalledWith(
        "https://eu.posthog.com/api/projects/114144/persons/bulk_delete/",
        {
          body: JSON.stringify({
            delete_events: true,
            delete_recordings: true,
            distinct_ids: ["user-1"],
            keep_person: false,
          }),
          headers: {
            Authorization: "Bearer phx_test",
            "Content-Type": "application/json",
          },
          method: "POST",
        }
      );
    })
  );

  it.live(
    "accepts an idempotent retry after the person is already absent",
    () =>
      Effect.gen(function* () {
        const request = vi.fn(
          async () =>
            new Response(
              JSON.stringify({
                deletion_errors: [],
                events_queued_for_deletion: false,
                persons_deleted: 0,
                persons_found: 0,
                recordings_queued_for_deletion: false,
              }),
              { status: 202 }
            )
        );

        expect(
          yield* erasePostHogPerson("user-1", { config, request })
        ).toBeUndefined();
      })
  );

  it.live("returns a typed failure when credentials are missing", () =>
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

  it.live(
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

  it.live("rejects a non-numeric PostHog project id before auth removal", () =>
    Effect.gen(function* () {
      const failure = yield* ensurePostHogErasureConfigured({
        ...config,
        projectId: "not-a-project-id",
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(PostHogErasureConfigError);
    })
  );

  it.live("returns a typed failure for an invalid host", () =>
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

  it.live("never sends the deletion credential outside PostHog", () =>
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

  it.live("returns a typed failure when the request cannot be sent", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: async () => await Promise.reject(new Error("offline")),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
    })
  );

  it.live("returns a typed failure when PostHog rejects erasure", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: async () => new Response(null, { status: 403 }),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe("PostHog person erasure returned HTTP 403.");
    })
  );

  it.live("returns a typed failure for an invalid success response", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: async () => new Response(null, { status: 202 }),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe(
        "PostHog person erasure returned an invalid response."
      );
    })
  );

  it.live("retries when PostHog reports a partial erasure failure", () =>
    Effect.gen(function* () {
      const failure = yield* erasePostHogPerson("user-1", {
        config,
        request: async () =>
          new Response(
            JSON.stringify({
              deletion_errors: [{ person_uuid: "person-1" }],
              events_queued_for_deletion: false,
              persons_deleted: 0,
              persons_found: 1,
              recordings_queued_for_deletion: false,
            }),
            { status: 202 }
          ),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe(
        "PostHog did not accept complete analytics erasure."
      );
    })
  );

  it.live.each([
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
        request: async () =>
          new Response(
            JSON.stringify({
              deletion_errors: [],
              ...result,
            }),
            { status: 202 }
          ),
      }).pipe(Effect.flip);

      expect(failure).toBeInstanceOf(PostHogErasureRequestError);
      expect(failure.message).toBe(
        "PostHog did not accept complete analytics erasure."
      );
    })
  );
});

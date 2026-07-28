import {
  deletePostHogPerson,
  ensurePostHogDeletionConfigured,
  PostHogDeletionConfigError,
  PostHogDeletionRequestError,
} from "@repo/backend/convex/analytics/deletion";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const config = {
  deletionApiKey: "phx_test",
  host: "https://eu.i.posthog.com",
  projectId: "114144",
};

describe("analytics/deletion", () => {
  it("requests person, event, and recording deletion", async () => {
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

    await Effect.runPromise(deletePostHogPerson("user-1", { config, request }));

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
  });

  it("returns a typed failure when credentials are missing", async () => {
    const failure = await Effect.runPromise(
      deletePostHogPerson("user-1", {
        config: {
          ...config,
          deletionApiKey: "",
        },
        request: fetch,
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionConfigError);
  });

  it("rejects account deletion before auth removal without credentials", async () => {
    const failure = await Effect.runPromise(
      ensurePostHogDeletionConfigured({
        ...config,
        deletionApiKey: " ",
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionConfigError);
  });

  it("rejects a non-numeric PostHog project id before auth removal", async () => {
    const failure = await Effect.runPromise(
      ensurePostHogDeletionConfigured({
        ...config,
        projectId: "not-a-project-id",
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionConfigError);
  });

  it("returns a typed failure for an invalid host", async () => {
    const failure = await Effect.runPromise(
      deletePostHogPerson("user-1", {
        config: {
          ...config,
          host: "not a URL",
        },
        request: fetch,
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionConfigError);
  });

  it("never sends the deletion credential outside PostHog", async () => {
    const request = vi.fn<typeof fetch>();
    const failure = await Effect.runPromise(
      deletePostHogPerson("user-1", {
        config: {
          ...config,
          host: "https://eu.i.posthog.com.example.com",
        },
        request,
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionConfigError);
    expect(request).not.toHaveBeenCalled();
  });

  it("returns a typed failure when the request cannot be sent", async () => {
    const failure = await Effect.runPromise(
      deletePostHogPerson("user-1", {
        config,
        request: async () => await Promise.reject(new Error("offline")),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionRequestError);
  });

  it("returns a typed failure when PostHog rejects deletion", async () => {
    const failure = await Effect.runPromise(
      deletePostHogPerson("user-1", {
        config,
        request: async () => new Response(null, { status: 403 }),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionRequestError);
    expect(failure.message).toBe("PostHog person deletion returned HTTP 403.");
  });

  it("returns a typed failure for an invalid success response", async () => {
    const failure = await Effect.runPromise(
      deletePostHogPerson("user-1", {
        config,
        request: async () => new Response(null, { status: 202 }),
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionRequestError);
    expect(failure.message).toBe(
      "PostHog person deletion returned an invalid response."
    );
  });

  it("retries when PostHog reports a partial deletion failure", async () => {
    const failure = await Effect.runPromise(
      deletePostHogPerson("user-1", {
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
      }).pipe(Effect.flip)
    );

    expect(failure).toBeInstanceOf(PostHogDeletionRequestError);
    expect(failure.message).toBe(
      "PostHog could not delete every matched person."
    );
  });
});

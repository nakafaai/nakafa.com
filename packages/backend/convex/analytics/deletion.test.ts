import {
  deletePostHogPerson,
  ensurePostHogDeletionConfigured,
  PostHogDeletionConfigError,
  PostHogDeletionRequestError,
} from "@repo/backend/convex/analytics/deletion";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

const config = {
  host: "https://eu.i.posthog.com",
  personalApiKey: "phx_test",
  projectToken: "phc_test",
};

describe("analytics/deletion", () => {
  it("requests person, event, and recording deletion", async () => {
    const request = vi.fn(async () => new Response(null, { status: 202 }));

    await Effect.runPromise(deletePostHogPerson("user-1", { config, request }));

    expect(request).toHaveBeenCalledWith(
      "https://eu.posthog.com/api/projects/@current/persons/bulk_delete/?token=phc_test",
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
          personalApiKey: "",
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
        personalApiKey: " ",
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
});

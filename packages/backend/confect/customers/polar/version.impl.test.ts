import { beforeEach, describe, expect, it } from "@effect/vitest";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { internal } from "@repo/backend/convex/_generated/api";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect } from "effect";

const polarFetch = vi.hoisted(() => vi.fn<typeof fetch>());
vi.stubGlobal("fetch", polarFetch);

/** One webhook endpoint as Polar returns it. */
function endpoint(id: string, version: string) {
  return {
    api_version: version,
    created_at: "2026-01-01T00:00:00Z",
    enabled: true,
    events: [],
    format: "raw",
    id,
    modified_at: null,
    organization_id: "organization-1",
    secret: "never-returned",
    url: `https://example.com/${id}`,
    uses_standard_webhook_signature: true,
  };
}

/** Answers one Polar request with JSON. */
function json(body: unknown) {
  return Promise.resolve(
    new Response(encodeJsonText(body), {
      headers: { "content-type": "application/json" },
      status: 200,
    })
  );
}

describe("Polar webhook payload version", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("POLAR_ACCESS_TOKEN", "polar_test");
  });

  it.effect(
    "moves an endpoint on another version, leaves a current one, and returns no secret",
    () =>
      Effect.gen(function* () {
        polarFetch
          .mockImplementationOnce(() =>
            json({
              items: [endpoint("old", "2026-04"), endpoint("new", "2026-10")],
              pagination: { max_page: 1, total_count: 2 },
            })
          )
          .mockImplementationOnce(() => json(endpoint("old", "2026-10")));
        const test = createConvexTestWithBetterAuth();
        const changes = yield* Effect.promise(() =>
          test.action(internal.customers.polar.version.setWebhookVersion, {})
        );
        expect(changes).toEqual([
          { after: "2026-10", before: "2026-04", id: "old" },
          { after: "2026-10", before: "2026-10", id: "new" },
        ]);
        const requests = Arr.map(polarFetch.mock.calls, ([input, init]) => {
          const request = new Request(input, init);
          return `${request.method} ${new URL(request.url).pathname}`;
        });
        expect(requests).toEqual([
          "GET /v1/webhooks/endpoints",
          "PATCH /v1/webhooks/endpoints/old",
        ]);
      })
  );
});

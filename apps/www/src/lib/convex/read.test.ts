import { describe, expect, it } from "@effect/vitest";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Effect, Schema } from "effect";
import { readOnce } from "@/lib/convex/read";

const client = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/convex/client", () => ({
  readConvexClient: () => client,
}));

const slug = Schema.decodeUnknownSync(TenantSlug)("harapan");

describe("convex readOnce", () => {
  it.effect(
    "reads the query once on the browser's client and decodes its answer",
    () =>
      Effect.gen(function* () {
        client.query.mockResolvedValueOnce(true);
        const refused = yield* readOnce(tenancy.profile.refusal, { slug });
        expect(refused).toBe(true);
        expect(client.query).toHaveBeenCalledWith(expect.anything(), { slug });
      })
  );

  it.effect(
    "fails when the read fails, so the loader leaves it to the page",
    () =>
      Effect.gen(function* () {
        client.query.mockRejectedValueOnce(new Error("offline"));
        const failure = yield* readOnce(tenancy.profile.refusal, { slug }).pipe(
          Effect.flip
        );
        expect(failure._tag).toBe("UnknownError");
      })
  );

  it.effect("fails when the answer does not decode", () =>
    Effect.gen(function* () {
      client.query.mockResolvedValueOnce("not a boolean");
      const failure = yield* readOnce(tenancy.profile.refusal, { slug }).pipe(
        Effect.flip
      );
      expect(failure._tag).toBe("UnknownError");
    })
  );
});

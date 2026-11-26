import { describe, expect, it } from "@effect/vitest";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { ConvexError } from "convex/values";
import { Effect, Schema } from "effect";
import { readOnce, readQueryOn } from "@/lib/convex/read";

const client = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock("@/lib/convex/client", () => ({
  readConvexClient: () => client,
}));

const slug = Schema.decodeSync(TenantSlug)("harapan");

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

describe("convex readQueryOn", () => {
  it.effect(
    "reads a Confect query on the given client and decodes its answer",
    () =>
      Effect.gen(function* () {
        const direct = { query: vi.fn().mockResolvedValueOnce(true) };
        const refused = yield* readQueryOn(direct, tenancy.profile.refusal, {
          slug,
        });
        expect(refused).toBe(true);
      })
  );

  it.effect(
    "passes through a typed refusal decoded from a ConvexError on a given client",
    () =>
      Effect.gen(function* () {
        const encoded = yield* Schema.encodeEffect(AccessDenied)(
          new AccessDenied({
            action: "tenant.view",
            reason: "resource",
          })
        );
        const direct = {
          query: vi.fn().mockRejectedValueOnce(new ConvexError(encoded)),
        };
        const failure = yield* readQueryOn(direct, tenancy.viewer.get, {
          slug,
        }).pipe(Effect.flip);
        expect(failure).toBeInstanceOf(AccessDenied);
      })
  );

  it.effect("wraps unknown transport failures in QueryReadFailed", () =>
    Effect.gen(function* () {
      const direct = {
        query: vi.fn().mockRejectedValueOnce(new Error("offline")),
      };
      const failure = yield* readQueryOn(direct, tenancy.profile.refusal, {
        slug,
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("QueryReadFailed");
    })
  );

  it.effect("wraps undecodable answers in QueryReadFailed", () =>
    Effect.gen(function* () {
      const direct = {
        query: vi.fn().mockResolvedValueOnce("not a boolean"),
      };
      const failure = yield* readQueryOn(direct, tenancy.profile.refusal, {
        slug,
      }).pipe(Effect.flip);
      expect(failure._tag).toBe("QueryReadFailed");
    })
  );
});

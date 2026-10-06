import { RegisteredConvexFunction, RegisteredFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import {
  isRollbackUpsert,
  MAX_ROLLBACK_PAGE_BYTES,
  RollbackPageSchema,
  type RollbackRecord,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import { RoutePageSchema } from "@nakafa/aksara-contracts/release/route/page";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { PublicationRequestSchema } from "@nakafa/aksara-contracts/transport/request";
import confectSchema from "@repo/backend/confect/_generated/schema";
import type { stageEnvelopeValidator } from "@repo/backend/confect/contentRelease/envelope.spec";
import { readRollback } from "@repo/backend/confect/contentRelease/ingress/rollback";
import {
  RELEASE_PAGE_LIMIT,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { TEST_KEY_RESOLVER } from "@repo/backend/test/content/proof";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  activateAuthenticatedRelease,
  insertRollbackItems,
  insertRollbackRoutes,
  readRollbackEnvelope,
  UnexpectedRollbackTestState,
} from "@repo/backend/test/rollback/ingress";
import { convexTest, type TestConvex } from "convex-test";
import { Cause, Effect, Exit, Schema } from "effect";

type StoredRollbackEnvelope = typeof stageEnvelopeValidator.Type;
type RollbackReadRequest = Parameters<typeof readRollback>[0];
const prepareRollback = internal.contentRelease.rollback.prepareRollback;

/** Decodes one strict body rollback request owned by this suite. */
const makeBodyRequest = Effect.fn("test.contentRelease.makeBodyRequest")(
  function* (manifestHash: string, afterIndex: number, limit: number) {
    const request = yield* Schema.decodeEffect(PublicationRequestSchema)({
      afterIndex,
      limit,
      operation: "rollbackPage",
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: manifestHash,
    });
    if (request.operation !== "rollbackPage") {
      return yield* Effect.die(
        new UnexpectedRollbackTestState({
          operation: "select-body-request",
        })
      );
    }
    return request;
  }
);

/** Decodes one strict route rollback request owned by this suite. */
const makeRouteRequest = Effect.fn("test.contentRelease.makeRouteRequest")(
  function* (manifestHash: string, afterIndex: number, limit: number) {
    const request = yield* Schema.decodeEffect(PublicationRequestSchema)({
      afterIndex,
      limit,
      operation: "routePage",
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: manifestHash,
    });
    if (request.operation !== "routePage") {
      return yield* Effect.die(
        new UnexpectedRollbackTestState({
          operation: "select-route-request",
        })
      );
    }
    return request;
  }
);

/** Runs one rollback read through the real Convex action boundary. */
const runRollback = Effect.fn("test.contentRelease.runRollback")(function* (
  target: TestConvex<typeof schema>,
  request: RollbackReadRequest
) {
  const runtimeServices = yield* Effect.context<never>();
  return yield* Effect.promise(() =>
    target.action((ctx) =>
      Effect.runPromiseWith(runtimeServices)(
        readRollback(request).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
        )
      )
    )
  );
});

/** Runs one rollback read against caller-supplied query chunk bytes. */
const readRollbackPages = Effect.fn("test.contentRelease.readRollbackPages")(
  function* (
    target: TestConvex<typeof schema>,
    request: RollbackReadRequest,
    envelope: StoredRollbackEnvelope,
    pages: readonly string[]
  ) {
    const runtimeServices = yield* Effect.context<never>();
    return yield* Effect.promise(() =>
      target.action((ctx) => {
        const runQuery = vi.spyOn(ctx, "runQuery");
        runQuery.mockResolvedValueOnce(envelope);
        for (const page of pages) {
          runQuery.mockResolvedValueOnce(page);
        }
        return Effect.runPromiseWith(runtimeServices)(
          readRollback(request).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            ),
            Effect.provide(RegisteredFunction.actionLayer(confectSchema, ctx))
          )
        );
      })
    );
  }
);

/** Returns one rejected rollback program as its complete rendered cause. */
const rollbackFailure = Effect.fn("test.contentRelease.rollbackFailure")(
  function* (program: Effect.Effect<unknown>) {
    const exit = yield* Effect.exit(program);
    if (Exit.isSuccess(exit)) {
      return yield* Effect.die("Expected the rollback read to fail.");
    }
    return Cause.pretty(exit.cause);
  }
);

/** Encodes one caller-owned body page through its exact shared contract. */
function encodeBodyPage(page: unknown) {
  return JSON.stringify(Schema.decodeUnknownSync(RollbackPageSchema)(page));
}

/** Encodes one caller-owned route page through its exact shared contract. */
function encodeRoutePage(page: unknown) {
  return JSON.stringify(Schema.decodeUnknownSync(RoutePageSchema)(page));
}

/** Builds one schema-valid empty body page that cannot continue a real cursor. */
function stalledBodyPage(manifestHash: string) {
  return encodeBodyPage({
    done: true,
    nextIndex: -1,
    records: [],
    rollbackOf: TEST_RELEASE_ID,
    rollbackOfManifestHash: manifestHash,
    total: 0,
  });
}

/** Builds one schema-valid empty route page that cannot continue a real cursor. */
function stalledRoutePage(manifestHash: string) {
  return encodeRoutePage({
    done: true,
    nextIndex: -1,
    records: [],
    rollbackOf: TEST_RELEASE_ID,
    rollbackOfManifestHash: manifestHash,
    total: 0,
  });
}

/** Reads the canonical body page produced by the real internal query. */
const readBodySource = Effect.fn("test.contentRelease.readBodySource")(
  function* (
    target: TestConvex<typeof schema>,
    manifestHash: string,
    limit: number
  ) {
    return yield* Effect.promise(() =>
      target.query(prepareRollback, {
        afterIndex: -1,
        limit,
        rollbackOf: TEST_RELEASE_ID,
        rollbackOfManifestHash: manifestHash,
      })
    );
  }
);

/** Inflates one authenticated artifact so its record crosses the page ceiling. */
function inflateRecord(record: RollbackRecord, byteLength: number) {
  const { current } = record;
  if (!isRollbackUpsert(current)) {
    throw new Error("Expected an authenticated rollback upsert state.");
  }
  return {
    ...record,
    current: {
      ...current,
      artifact: Schema.decodeSync(SignedContentArtifactSchema)({
        ...current.artifact,
        payload: {
          ...current.artifact.payload,
          compiledCode: "x".repeat(byteLength),
        },
      }),
    },
  } satisfies RollbackRecord;
}
describe("content publication rollback reads", () => {
  it.effect(
    "aggregates safe body query transactions into one external page",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const itemCount = RELEASE_PAGE_LIMIT + 1;
        const release = yield* activateAuthenticatedRelease(t, itemCount);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRollbackItems(ctx, itemCount).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const request = yield* makeBodyRequest(
          release.manifestHash,
          -1,
          itemCount
        );
        const response = yield* runRollback(t, request);
        expect(response).toMatchObject({
          done: true,
          nextIndex: itemCount - 1,
          total: itemCount,
        });
        expect(response.records).toHaveLength(itemCount);
      })
  );
  it.effect(
    "aggregates safe route query transactions into one external page",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const routeCount = ROUTE_CATALOG_PAGE_LIMIT + 1;
        const release = yield* activateAuthenticatedRelease(t, 0, routeCount);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRollbackRoutes(ctx, routeCount).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const request = yield* makeRouteRequest(
          release.manifestHash,
          -1,
          routeCount
        );
        const response = yield* runRollback(t, request);
        expect(response).toMatchObject({
          done: true,
          nextIndex: routeCount - 1,
          total: routeCount,
        });
        expect(response.records).toHaveLength(routeCount);
      })
  );
  it.effect("rejects a body cursor beyond the activated release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const itemCount = 2;
      const release = yield* activateAuthenticatedRelease(t, itemCount);
      const request = yield* makeBodyRequest(
        release.manifestHash,
        itemCount,
        itemCount
      );
      const message = yield* rollbackFailure(runRollback(t, request));
      expect(message).toContain("Rollback cursor 2 exceeds release");
    })
  );
  it.effect("rejects a route cursor beyond the activated release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const routeCount = 2;
      const release = yield* activateAuthenticatedRelease(t, 0, routeCount);
      const request = yield* makeRouteRequest(
        release.manifestHash,
        routeCount,
        routeCount
      );
      const message = yield* rollbackFailure(runRollback(t, request));
      expect(message).toContain("Route cursor 2 exceeds release");
    })
  );
  it.effect("rejects a body query page that is not valid JSON", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const itemCount = 2;
      const release = yield* activateAuthenticatedRelease(t, itemCount);
      const envelope = yield* readRollbackEnvelope(t);
      const request = yield* makeBodyRequest(release.manifestHash, -1, 2);
      const message = yield* rollbackFailure(
        readRollbackPages(t, request, envelope, ["{not-json"])
      );
      expect(message).toContain("Rollback query page is not valid JSON.");
    })
  );
  it.effect("rejects a body query page that violates its exact contract", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const itemCount = 2;
      const release = yield* activateAuthenticatedRelease(t, itemCount);
      const envelope = yield* readRollbackEnvelope(t);
      const request = yield* makeBodyRequest(release.manifestHash, -1, 2);
      const message = yield* rollbackFailure(
        readRollbackPages(t, request, envelope, [JSON.stringify({})])
      );
      expect(message).toContain("violates its exact contract");
    })
  );
  it.effect("rejects an empty body query chunk for a non-empty release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const itemCount = 2;
      const release = yield* activateAuthenticatedRelease(t, itemCount);
      const envelope = yield* readRollbackEnvelope(t);
      const request = yield* makeBodyRequest(release.manifestHash, -1, 2);
      const message = yield* rollbackFailure(
        readRollbackPages(t, request, envelope, [
          stalledBodyPage(release.manifestHash),
        ])
      );
      expect(message).toContain("returned a mismatched query chunk");
    })
  );
  it.effect(
    "returns an empty body page when the release owns no transitions",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const release = yield* activateAuthenticatedRelease(t, 0);
        const request = yield* makeBodyRequest(release.manifestHash, -1, 1);
        const response = yield* runRollback(t, request);
        expect(response).toMatchObject({
          done: true,
          nextIndex: -1,
          total: 0,
        });
        expect(response.records).toHaveLength(0);
      })
  );
  it.effect("rejects one transition above the rollback page byte ceiling", () =>
    Effect.gen(function* () {
      const runtimeServices = yield* Effect.context<never>();
      const t = convexTest(schema, convexModules);
      const release = yield* activateAuthenticatedRelease(t, 1);
      yield* Effect.promise(() =>
        t.mutation((ctx) =>
          Effect.runPromiseWith(runtimeServices)(
            insertRollbackItems(ctx, 1).pipe(
              Effect.provide(
                RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
              )
            )
          )
        )
      );
      const envelope = yield* readRollbackEnvelope(t);
      const request = yield* makeBodyRequest(release.manifestHash, -1, 1);
      const source = yield* readBodySource(t, release.manifestHash, 1);
      const page = yield* Schema.decodeEffect(
        Schema.fromJsonString(RollbackPageSchema)
      )(source);
      const record = page.records[0];
      if (!record) {
        return yield* Effect.die(
          new UnexpectedRollbackTestState({
            operation: "select-body-record",
          })
        );
      }
      const oversized = JSON.stringify({
        ...page,
        records: [inflateRecord(record, MAX_ROLLBACK_PAGE_BYTES)],
      });
      const message = yield* rollbackFailure(
        readRollbackPages(t, request, envelope, [oversized])
      );
      expect(message).toContain("exceeds the page byte ceiling");
    })
  );
  it.effect(
    "retains transitions when the next one exceeds the byte ceiling",
    () =>
      Effect.gen(function* () {
        const runtimeServices = yield* Effect.context<never>();
        const t = convexTest(schema, convexModules);
        const itemCount = 2;
        const release = yield* activateAuthenticatedRelease(t, itemCount);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            Effect.runPromiseWith(runtimeServices)(
              insertRollbackItems(ctx, itemCount).pipe(
                Effect.provide(
                  RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
                )
              )
            )
          )
        );
        const envelope = yield* readRollbackEnvelope(t);
        const request = yield* makeBodyRequest(
          release.manifestHash,
          -1,
          itemCount
        );
        const source = yield* readBodySource(
          t,
          release.manifestHash,
          itemCount
        );
        const page = yield* Schema.decodeEffect(
          Schema.fromJsonString(RollbackPageSchema)
        )(source);
        const [first, second] = page.records;
        if (!(first && second)) {
          return yield* Effect.die(
            new UnexpectedRollbackTestState({
              operation: "select-body-record",
            })
          );
        }
        const response = yield* readRollbackPages(t, request, envelope, [
          JSON.stringify({
            ...page,
            records: [first, inflateRecord(second, MAX_ROLLBACK_PAGE_BYTES)],
          }),
        ]);
        expect(response.records).toHaveLength(1);
        expect(response.records[0]).toMatchObject({
          index: 0,
        });
      })
  );
  it.effect("rejects an empty route query chunk for a non-empty release", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const routeCount = 2;
      const release = yield* activateAuthenticatedRelease(t, 0, routeCount);
      const envelope = yield* readRollbackEnvelope(t);
      const request = yield* makeRouteRequest(release.manifestHash, -1, 2);
      const message = yield* rollbackFailure(
        readRollbackPages(t, request, envelope, [
          stalledRoutePage(release.manifestHash),
        ])
      );
      expect(message).toContain("returned a mismatched query chunk");
    })
  );
  it.effect(
    "returns an empty route page when the release owns no transitions",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const release = yield* activateAuthenticatedRelease(t, 0, 0);
        const request = yield* makeRouteRequest(release.manifestHash, -1, 1);
        const response = yield* runRollback(t, request);
        expect(response).toMatchObject({
          done: true,
          nextIndex: -1,
          total: 0,
        });
        expect(response.records).toHaveLength(0);
      })
  );
});

import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import {
  isRollbackUpsert,
  MAX_ROLLBACK_PAGE_BYTES,
  RollbackPageSchema,
  type RollbackRecord,
} from "@nakafa/aksara-contracts/release/rollback/spec";
import { RoutePageSchema } from "@nakafa/aksara-contracts/release/route/page";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { PublicationRequestSchema } from "@nakafa/aksara-contracts/transport/request";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { readRollback } from "@repo/backend/convex/contentRelease/ingress/rollback";
import { makePublicationReceipt } from "@repo/backend/convex/contentRelease/receipt";
import {
  RELEASE_PAGE_LIMIT,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import {
  runConvexActionProgram,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  TEST_RELEASE_ID,
  testReleaseJson,
} from "@repo/backend/test/content/release";
import {
  activateRollbackFixture,
  insertRollbackItem,
  insertRoute,
} from "@repo/backend/test/content/rollback";
import { makeFunctionReference } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";
import { Cause, Data, Effect, Exit, Schema } from "effect";

class UnexpectedRollbackTestState extends Data.TaggedError(
  "UnexpectedRollbackTestState"
)<{
  readonly operation:
    | "activate-release"
    | "select-body-request"
    | "select-body-record"
    | "select-route-request";
}> {}

interface StoredRollbackEnvelope {
  readonly releaseJson: string;
  readonly rendererJson: string;
}

interface RollbackQueryArgs extends Record<string, number | string> {
  readonly afterIndex: number;
  readonly limit: number;
  readonly rollbackOf: string;
  readonly rollbackOfManifestHash: string;
}

type RollbackReadRequest = Parameters<typeof readRollback>[1];

const prepareRollback = makeFunctionReference<
  "query",
  RollbackQueryArgs,
  string
>("contentRelease/rollback:prepareRollback");

/** Stores the exact authenticated release and active identity under test. */
const storeAuthenticatedRelease = Effect.fn(
  "test.contentRelease.storeAuthenticatedRelease"
)(function* (
  ctx: MutationCtx,
  itemCount: number,
  routeCount: number,
  release: ReturnType<typeof testSignedRelease>
) {
  yield* Effect.promise(() =>
    activateRollbackFixture(ctx, itemCount, routeCount)
  );
  const stored = yield* Effect.promise(() =>
    ctx.db.query("contentReleases").unique()
  );
  const state = yield* Effect.promise(() =>
    ctx.db.query("contentState").unique()
  );
  if (!(stored && state)) {
    return yield* Effect.die(
      new UnexpectedRollbackTestState({ operation: "activate-release" })
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", stored._id, {
      receiptJson: JSON.stringify(makePublicationReceipt(stored, release)),
      releaseJson: JSON.stringify(release),
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    })
  );
  yield* Effect.promise(() =>
    ctx.db.patch("contentState", state._id, {
      activeManifestHash: release.manifestHash,
    })
  );
});

/** Activates one authenticated release that the ingress may replay. */
const activateAuthenticatedRelease = Effect.fn(
  "test.contentRelease.activateAuthenticatedRelease"
)(function* (
  target: TestConvex<typeof schema>,
  itemCount: number,
  routeCount = itemCount
) {
  const unsigned = yield* Schema.decodeEffect(
    Schema.fromJsonString(SignedContentReleaseSchema)
  )(
    testReleaseJson({
      itemCount,
      rendererHash: TEST_PROOF_RENDERER.hash,
      routeCount,
    })
  );
  const release = testSignedRelease(unsigned.manifest);
  yield* Effect.promise(() =>
    target.mutation((ctx) =>
      runConvexProgram(
        storeAuthenticatedRelease(ctx, itemCount, routeCount, release)
      )
    )
  );
  return release;
});

/** Inserts rollback body rows in the original deterministic order. */
const insertRollbackItems = Effect.fn(
  "test.contentRelease.insertRollbackItems"
)(function* (ctx: MutationCtx, itemCount: number) {
  for (let index = 0; index < itemCount; index += 1) {
    yield* Effect.promise(() =>
      insertRollbackItem(ctx, index, false, "return {};", {
        authenticatedArtifact: true,
      })
    );
  }
});

/** Inserts every prior and current route pair in deterministic order. */
const insertRollbackRoutes = Effect.fn(
  "test.contentRelease.insertRollbackRoutes"
)(function* (ctx: MutationCtx, routeCount: number) {
  for (let index = 0; index < routeCount; index += 1) {
    const publicPath = `test/route-${index}`;
    yield* Effect.promise(() =>
      insertRoute(ctx, {
        contentKey: `test:prior-${index}`,
        index,
        publicPath,
        releaseId: "release-base",
        sequence: 0,
      })
    );
    yield* Effect.promise(() =>
      insertRoute(ctx, {
        contentKey: `test:current-${index}`,
        index,
        publicPath,
      })
    );
  }
});

/** Reads one activated release envelope without running the rollback query. */
const readRollbackEnvelope = Effect.fn(
  "test.contentRelease.readRollbackEnvelope"
)(function* (target: TestConvex<typeof schema>) {
  const stored = yield* Effect.promise(() =>
    target.run((ctx) => ctx.db.query("contentReleases").unique())
  );
  if (!stored) {
    return yield* Effect.die(
      new UnexpectedRollbackTestState({ operation: "activate-release" })
    );
  }
  return {
    releaseJson: stored.releaseJson,
    rendererJson: stored.rendererJson,
  } satisfies StoredRollbackEnvelope;
});

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
        new UnexpectedRollbackTestState({ operation: "select-body-request" })
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
        new UnexpectedRollbackTestState({ operation: "select-route-request" })
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
  return yield* Effect.promise(() =>
    target.action((ctx) =>
      runConvexActionProgram(
        readRollback(ctx, request).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
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
    return yield* Effect.promise(() =>
      target.action((ctx) => {
        const runQuery = vi.spyOn(ctx, "runQuery");
        runQuery.mockResolvedValueOnce(envelope);
        for (const page of pages) {
          runQuery.mockResolvedValueOnce(page);
        }
        return runConvexActionProgram(
          readRollback(ctx, request).pipe(
            Effect.provideService(
              ContentVerificationKeyResolver,
              TEST_KEY_RESOLVER
            )
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
        const t = convexTest(schema, convexModules);
        const itemCount = RELEASE_PAGE_LIMIT + 1;
        const release = yield* activateAuthenticatedRelease(t, itemCount);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertRollbackItems(ctx, itemCount))
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
        const t = convexTest(schema, convexModules);
        const routeCount = ROUTE_CATALOG_PAGE_LIMIT + 1;
        const release = yield* activateAuthenticatedRelease(t, 0, routeCount);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertRollbackRoutes(ctx, routeCount))
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

        expect(response).toMatchObject({ done: true, nextIndex: -1, total: 0 });
        expect(response.records).toHaveLength(0);
      })
  );

  it.effect("rejects one transition above the rollback page byte ceiling", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      const release = yield* activateAuthenticatedRelease(t, 1);
      yield* Effect.promise(() =>
        t.mutation((ctx) => runConvexProgram(insertRollbackItems(ctx, 1)))
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
          new UnexpectedRollbackTestState({ operation: "select-body-record" })
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
        const t = convexTest(schema, convexModules);
        const itemCount = 2;
        const release = yield* activateAuthenticatedRelease(t, itemCount);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(insertRollbackItems(ctx, itemCount))
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
            new UnexpectedRollbackTestState({ operation: "select-body-record" })
          );
        }

        const response = yield* readRollbackPages(t, request, envelope, [
          JSON.stringify({
            ...page,
            records: [first, inflateRecord(second, MAX_ROLLBACK_PAGE_BYTES)],
          }),
        ]);

        expect(response.records).toHaveLength(1);
        expect(response.records[0]).toMatchObject({ index: 0 });
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

        expect(response).toMatchObject({ done: true, nextIndex: -1, total: 0 });
        expect(response.records).toHaveLength(0);
      })
  );
});

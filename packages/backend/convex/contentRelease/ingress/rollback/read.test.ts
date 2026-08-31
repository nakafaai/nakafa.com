import { describe, expect, it } from "@effect/vitest";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { PublicationRequestSchema } from "@nakafa/aksara-contracts/transport/request";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { readRollback } from "@repo/backend/convex/contentRelease/ingress/rollback/read";
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
import { convexTest, type TestConvex } from "convex-test";
import { Data, Effect, Schema } from "effect";

class UnexpectedRollbackTestState extends Data.TaggedError(
  "UnexpectedRollbackTestState"
)<{
  readonly operation:
    | "activate-release"
    | "select-body-request"
    | "select-route-request";
}> {}

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

        const request = yield* Schema.decodeEffect(PublicationRequestSchema)({
          afterIndex: -1,
          limit: itemCount,
          operation: "rollbackPage",
          rollbackOf: TEST_RELEASE_ID,
          rollbackOfManifestHash: release.manifestHash,
        });
        if (request.operation !== "rollbackPage") {
          return yield* Effect.die(
            new UnexpectedRollbackTestState({
              operation: "select-body-request",
            })
          );
        }
        const response = yield* Effect.promise(() =>
          t.action((ctx) =>
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

        const request = yield* Schema.decodeEffect(PublicationRequestSchema)({
          afterIndex: -1,
          limit: routeCount,
          operation: "routePage",
          rollbackOf: TEST_RELEASE_ID,
          rollbackOfManifestHash: release.manifestHash,
        });
        if (request.operation !== "routePage") {
          return yield* Effect.die(
            new UnexpectedRollbackTestState({
              operation: "select-route-request",
            })
          );
        }
        const response = yield* Effect.promise(() =>
          t.action((ctx) =>
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

        expect(response).toMatchObject({
          done: true,
          nextIndex: routeCount - 1,
          total: routeCount,
        });
        expect(response.records).toHaveLength(routeCount);
      })
  );
});

import { RegisteredConvexFunction } from "@confect/server";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import confectSchema from "@repo/backend/confect/_generated/schema";
import contentReleases from "@repo/backend/confect/_generated/tables/contentReleases";
import type { stageEnvelopeValidator } from "@repo/backend/confect/contentRelease/envelope.spec";
import { makePublicationReceipt } from "@repo/backend/confect/contentRelease/receipt";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type schema from "@repo/backend/convex/schema";
import {
  TEST_PROOF_RENDERER,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import { testReleaseJson } from "@repo/backend/test/content/release";
import {
  activateRollbackFixture,
  insertRollbackItem,
  insertRoute,
} from "@repo/backend/test/content/rollback";
import type { TestConvex } from "convex-test";
import { Data, Effect, Schema } from "effect";

type StoredRollbackEnvelope = typeof stageEnvelopeValidator.Type;
export class UnexpectedRollbackTestState extends Data.TaggedError(
  "UnexpectedRollbackTestState"
)<{
  readonly operation:
    | "activate-release"
    | "select-body-request"
    | "select-body-record"
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
      new UnexpectedRollbackTestState({
        operation: "activate-release",
      })
    );
  }
  const releaseDocument = yield* Schema.decodeEffect(contentReleases.Doc)(
    stored
  );
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", stored._id, {
      receiptJson: JSON.stringify(
        makePublicationReceipt(releaseDocument, release)
      ),
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
export const activateAuthenticatedRelease = Effect.fn(
  "test.contentRelease.activateAuthenticatedRelease"
)(function* (
  target: TestConvex<typeof schema>,
  itemCount: number,
  routeCount = itemCount
) {
  const runtimeServices = yield* Effect.context<never>();
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
      Effect.runPromiseWith(runtimeServices)(
        storeAuthenticatedRelease(ctx, itemCount, routeCount, release).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    )
  );
  return release;
});

/** Inserts rollback body rows in the original deterministic order. */
export const insertRollbackItems = Effect.fn(
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
export const insertRollbackRoutes = Effect.fn(
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
export const readRollbackEnvelope = Effect.fn(
  "test.contentRelease.readRollbackEnvelope"
)(function* (target: TestConvex<typeof schema>) {
  const stored = yield* Effect.promise(() =>
    target.run((ctx) => ctx.db.query("contentReleases").unique())
  );
  if (!stored) {
    return yield* Effect.die(
      new UnexpectedRollbackTestState({
        operation: "activate-release",
      })
    );
  }
  return {
    releaseJson: stored.releaseJson,
    rendererJson: stored.rendererJson,
    role: stored.role,
  } satisfies StoredRollbackEnvelope;
});

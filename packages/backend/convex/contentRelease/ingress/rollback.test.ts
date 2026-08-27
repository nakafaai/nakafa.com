import { describe, expect, it } from "@effect/vitest";
import { SignedContentReleaseSchema } from "@nakafa/aksara-contracts/release";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import { PublicationRequestSchema } from "@nakafa/aksara-contracts/transport/request";
import { readRollback } from "@repo/backend/convex/contentRelease/ingress/rollback";
import { makePublicationReceipt } from "@repo/backend/convex/contentRelease/receipt";
import {
  RELEASE_PAGE_LIMIT,
  ROUTE_CATALOG_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
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
import { Effect, Schema } from "effect";

/** Activates one authenticated release that the ingress may replay. */
async function activateAuthenticatedRelease(
  t: TestConvex<typeof schema>,
  itemCount: number,
  routeCount = itemCount
) {
  const unsigned = Schema.decodeUnknownSync(SignedContentReleaseSchema)(
    JSON.parse(
      testReleaseJson({
        itemCount,
        rendererHash: TEST_PROOF_RENDERER.hash,
        routeCount,
      })
    )
  );
  const release = testSignedRelease(unsigned.manifest);
  await t.mutation(async (ctx) => {
    await activateRollbackFixture(ctx, itemCount, routeCount);
    const stored = await ctx.db.query("contentReleases").unique();
    const state = await ctx.db.query("contentState").unique();
    if (!(stored && state)) {
      throw new Error("Expected one rollback release fixture.");
    }
    await ctx.db.patch("contentReleases", stored._id, {
      receiptJson: JSON.stringify(makePublicationReceipt(stored, release)),
      releaseJson: JSON.stringify(release),
      rendererJson: JSON.stringify(TEST_PROOF_RENDERER),
    });
    await ctx.db.patch("contentState", state._id, {
      activeManifestHash: release.manifestHash,
    });
  });
  return release;
}

describe("content publication rollback reads", () => {
  it("aggregates safe body query transactions into one external page", async () => {
    const t = convexTest(schema, convexModules);
    const itemCount = RELEASE_PAGE_LIMIT + 1;
    const release = await activateAuthenticatedRelease(t, itemCount);
    await t.mutation(async (ctx) => {
      for (let index = 0; index < itemCount; index += 1) {
        await insertRollbackItem(ctx, index, false, "return {};", {
          authenticatedArtifact: true,
        });
      }
    });

    const request = Schema.decodeSync(PublicationRequestSchema)({
      afterIndex: -1,
      limit: itemCount,
      operation: "rollbackPage",
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: release.manifestHash,
    });
    if (request.operation !== "rollbackPage") {
      throw new Error("Expected one rollback page request.");
    }
    const response = await t.action((ctx) =>
      Effect.runPromise(
        readRollback(ctx, request).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
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
  });

  it("aggregates safe route query transactions into one external page", async () => {
    const t = convexTest(schema, convexModules);
    const routeCount = ROUTE_CATALOG_PAGE_LIMIT + 1;
    const release = await activateAuthenticatedRelease(t, 0, routeCount);
    await t.mutation(async (ctx) => {
      for (let index = 0; index < routeCount; index += 1) {
        const publicPath = `test/route-${index}`;
        await insertRoute(ctx, {
          contentKey: `test:prior-${index}`,
          index,
          publicPath,
          releaseId: "release-base",
          sequence: 0,
        });
        await insertRoute(ctx, {
          contentKey: `test:current-${index}`,
          index,
          publicPath,
        });
      }
    });

    const request = Schema.decodeSync(PublicationRequestSchema)({
      afterIndex: -1,
      limit: routeCount,
      operation: "routePage",
      rollbackOf: TEST_RELEASE_ID,
      rollbackOfManifestHash: release.manifestHash,
    });
    if (request.operation !== "routePage") {
      throw new Error("Expected one route rollback page request.");
    }
    const response = await t.action((ctx) =>
      Effect.runPromise(
        readRollback(ctx, request).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
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
  });
});

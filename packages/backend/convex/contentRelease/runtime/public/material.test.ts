// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { SignedContentArtifactSchema } from "@nakafa/aksara-contracts/content";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { MAX_PUBLIC_RUNTIME_RESPONSE_BYTES } from "@nakafa/aksara-contracts/runtime/spec";
import { MAX_MATERIAL_RUNTIME_RESPONSE_BYTES } from "@repo/backend/content/material";
import type { MaterialRuntimeRow } from "@repo/backend/convex/contentRelease/material/runtime";
import {
  decodeMaterialRow,
  dispatchMaterialProgram,
} from "@repo/backend/convex/contentRelease/runtime/public/material";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { makeFunctionReference } from "convex/server";
import { convexTest, type TestConvex } from "convex-test";
import { Effect, Schema } from "effect";

const readPublication = makeFunctionReference<
  "query",
  { readonly appLocale: ActiveAppLocaleCode; readonly publicPath: string },
  MaterialRuntimeRow
>("contentRelease/material/runtime:read");

/** Executes the cohesive material action adapter with exact UTF-8 bytes. */
function runDispatch(
  target: Pick<TestConvex<typeof schema>, "action">,
  request: {
    readonly appLocale: ActiveAppLocaleCode;
    readonly delivery: "public";
    readonly publicPath: string;
  }
) {
  const source = JSON.stringify(request);
  const byteLength = new TextEncoder().encode(source).byteLength;
  return target.action((ctx) =>
    runConvexProgram(dispatchMaterialProgram(ctx, source, byteLength))
  );
}

describe("contentRelease/runtime/public/material", () => {
  it("returns one coherent shell and body, plus exact route absence", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);

    const found = await runDispatch(target, {
      appLocale: requested.appLocale,
      delivery: "public",
      publicPath: requested.publicPath,
    });
    const missing = await runDispatch(target, {
      appLocale: requested.appLocale,
      delivery: "public",
      publicPath: "subjects/test/missing",
    });

    expect(found.status).toBe(200);
    const body = JSON.parse(found.body);
    expect(body).toMatchObject({
      kind: "found",
      model: {
        activeManifestHash: body.runtime.activeManifestHash,
        activeReleaseId: body.runtime.activeReleaseId,
        sourcePath: body.runtime.sourcePath,
      },
      runtime: {
        kind: "found",
        projection: { publicPath: requested.publicPath },
      },
    });
    expect(JSON.parse(body.model.projectionJson)).toEqual(
      body.runtime.projection
    );
    expect(new TextEncoder().encode(found.body).byteLength).toBeLessThanOrEqual(
      MAX_MATERIAL_RUNTIME_RESPONSE_BYTES
    );
    expect(missing).toEqual({ body: '{"kind":"missing"}', status: 404 });
  });

  it("sanitizes a cohesive response above its explicit byte ceiling", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await target.mutation(async (ctx) => {
      const artifact = await ctx.db.query("contentArtifacts").first();
      if (!artifact) {
        return expect.fail("Expected one selected material artifact.");
      }
      const value = Schema.decodeUnknownSync(SignedContentArtifactSchema)(
        JSON.parse(artifact.artifactJson),
        { onExcessProperty: "error" }
      );
      await ctx.db.patch("contentArtifacts", artifact._id, {
        artifactJson: JSON.stringify({
          ...value,
          payload: {
            ...value.payload,
            compiledCode: "x".repeat(MAX_MATERIAL_RUNTIME_RESPONSE_BYTES),
          },
        }),
      });
    });

    await expect(
      runDispatch(target, {
        appLocale: requested.appLocale,
        delivery: "public",
        publicPath: requested.publicPath,
      })
    ).resolves.toEqual({
      body: '{"code":"CONTENT_RUNTIME_RESPONSE_TOO_LARGE","kind":"failure"}',
      status: 500,
    });
  });

  it("rejects an oversized nested body below the material ceiling", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    await target.mutation(async (ctx) => {
      const artifact = await ctx.db.query("contentArtifacts").first();
      if (!artifact) {
        return expect.fail("Expected one selected material artifact.");
      }
      const value = Schema.decodeUnknownSync(SignedContentArtifactSchema)(
        JSON.parse(artifact.artifactJson),
        { onExcessProperty: "error" }
      );
      await ctx.db.patch("contentArtifacts", artifact._id, {
        artifactJson: JSON.stringify({
          ...value,
          payload: {
            ...value.payload,
            compiledCode: "x".repeat(MAX_PUBLIC_RUNTIME_RESPONSE_BYTES),
          },
        }),
      });
    });

    const response = await runDispatch(target, {
      appLocale: requested.appLocale,
      delivery: "public",
      publicPath: requested.publicPath,
    });

    expect(new TextEncoder().encode(response.body).byteLength).toBeLessThan(
      MAX_MATERIAL_RUNTIME_RESPONSE_BYTES
    );
    expect(response).toEqual({
      body: '{"code":"CONTENT_RUNTIME_RESPONSE_TOO_LARGE","kind":"failure"}',
      status: 500,
    });
  });

  it("rejects invalid requests and sanitizes a failed cohesive query", async () => {
    const target = convexTest(schema, convexModules);
    const requested = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(target);
    const source = JSON.stringify({
      appLocale: requested.appLocale,
      delivery: "public",
      publicPath: requested.publicPath,
    });
    const invalid = await target.action((ctx) =>
      runConvexProgram(dispatchMaterialProgram(ctx, source, 1))
    );
    await target.mutation(async (ctx) => {
      const artifact = await ctx.db.query("contentArtifacts").first();
      if (!artifact) {
        return expect.fail("Expected one selected material artifact.");
      }
      await ctx.db.delete("contentArtifacts", artifact._id);
    });
    const failed = await runDispatch(target, {
      appLocale: requested.appLocale,
      delivery: "public",
      publicPath: requested.publicPath,
    });

    expect(invalid).toEqual({
      body: '{"code":"CONTENT_RUNTIME_INVALID","kind":"failure"}',
      status: 400,
    });
    expect(failed).toEqual({
      body: '{"code":"CONTENT_RUNTIME_INTERNAL","kind":"failure"}',
      status: 500,
    });
  });

  it.live("fails closed for every shell and body coherence violation", () =>
    Effect.gen(function* () {
      const target = convexTest(schema, convexModules);
      const requested = makeMaterialProjection("en", 1);
      yield* Effect.promise(() => activateMaterialCatalog(target));
      const row = yield* Effect.promise(() =>
        target.query(readPublication, {
          appLocale: requested.appLocale,
          publicPath: requested.publicPath,
        })
      );
      if (!row.runtime) {
        return expect.fail("Expected one complete cohesive material row.");
      }
      const runtime = row.runtime;
      const corruptions: readonly (readonly [string, MaterialRuntimeRow])[] = [
        [
          "projection missing",
          { ...row, model: { ...row.model, projectionJson: null } },
        ],
        [
          "renderer domain missing",
          { ...row, model: { ...row.model, rendererDomain: null } },
        ],
        [
          "source path missing",
          { ...row, model: { ...row.model, sourcePath: null } },
        ],
        ["runtime missing", { ...row, runtime: null }],
        [
          "manifest mismatch",
          {
            ...row,
            runtime: {
              ...runtime,
              activeManifestHash: `sha256:${"f".repeat(64)}`,
            },
          },
        ],
        [
          "release mismatch",
          {
            ...row,
            runtime: { ...runtime, activeReleaseId: "release-mismatch" },
          },
        ],
        [
          "projection mismatch",
          {
            ...row,
            runtime: { ...runtime, projectionJson: "{}" },
          },
        ],
        [
          "source mismatch",
          {
            ...row,
            runtime: {
              ...runtime,
              sourcePath: "packages/corpus/material/mismatch/en.mdx",
            },
          },
        ],
        [
          "non-public body",
          {
            ...row,
            runtime: { ...runtime, delivery: "authenticated" },
          },
        ],
      ];

      for (const [reason, corruption] of corruptions) {
        const result = yield* decodeMaterialRow(corruption).pipe(Effect.result);
        expect(result, reason).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "MaterialRuntimeReadError" },
        });
      }

      const missing = yield* decodeMaterialRow({
        model: {
          ...row.model,
          projectionJson: null,
          rendererDomain: null,
          sourcePath: null,
        },
        runtime: null,
      });
      expect(missing).toBeNull();
    })
  );
});

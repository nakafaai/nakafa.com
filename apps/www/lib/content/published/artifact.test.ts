// @vitest-environment node

// Node tests isolate Next navigation imports while real semantic renderers execute.
vi.mock("@repo/internationalization/src/navigation", () => ({
  getPathname: vi.fn(),
  Link: vi.fn(),
  redirect: vi.fn(),
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

import { describe, expect, it } from "@effect/vitest";
import { compile } from "@mdx-js/mdx";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testSignedArtifact,
} from "@repo/backend/test/content/proof";
import { Effect } from "effect";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { executeSignedArtifact } from "@/lib/content/published/artifact";

describe("authenticated artifact execution", () => {
  it.effect(
    "authenticates compiled MDX and executes its real semantic component provider",
    () =>
      Effect.gen(function* () {
        const rawMdx = "Authenticated **lesson** body.";
        const compiledCode = String(
          yield* Effect.promise(() =>
            compile(rawMdx, {
              outputFormat: "function-body",
              providerImportSource: "@mdx-js/react",
            })
          )
        );
        const artifact = testSignedArtifact("site", { compiledCode, rawMdx });
        const rendered = yield* executeSignedArtifact({
          artifact,
          rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
          rendererManifest: TEST_PROOF_RENDERER,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        );

        expect(rendered.artifact).toEqual(artifact);
        expect(renderToStaticMarkup(createElement(rendered.Content))).toContain(
          "Authenticated <strong"
        );
        expect(renderToStaticMarkup(createElement(rendered.Content))).toContain(
          ">lesson</strong> body."
        );
      })
  );

  it.effect.each([
    ["evaluate", "throw new TypeError('broken compiled module');"],
    ["module", "return {};"],
  ] as const)(
    "preserves the signed identity when %s fails",
    ([stage, compiledCode]) =>
      Effect.gen(function* () {
        const artifact = testSignedArtifact("site", { compiledCode });
        const failure = yield* executeSignedArtifact({
          artifact,
          rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
          rendererManifest: TEST_PROOF_RENDERER,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          ),
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "ContentExecutionError",
          contentKey: artifact.payload.contentKey,
          stage,
        });
      })
  );

  it.effect("rejects changed compiled bytes before they can execute", () =>
    Effect.gen(function* () {
      const signed = testSignedArtifact("site", { compiledCode: "return {};" });
      const failure = yield* executeSignedArtifact({
        artifact: {
          ...signed,
          payload: {
            ...signed.payload,
            compiledCode: "throw new TypeError('unverified code');",
          },
        },
        rendererContractVersion: TEST_PROOF_RENDERER.rendererContractVersion,
        rendererManifest: TEST_PROOF_RENDERER,
      }).pipe(
        Effect.provideService(
          ContentVerificationKeyResolver,
          TEST_KEY_RESOLVER
        ),
        Effect.flip
      );
      expect(failure).toMatchObject({
        _tag: "ArtifactHashMismatchError",
        contentKey: signed.payload.contentKey,
      });
    })
  );
});

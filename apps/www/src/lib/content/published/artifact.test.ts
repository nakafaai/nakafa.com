// @vitest-environment node

// Node tests isolate Next navigation imports while real semantic renderers execute.
import { describe, expect, it } from "@effect/vitest";
import { ContentVerificationKeyResolver } from "@nakafa/aksara-contracts/signature/spec";
import {
  TEST_KEY_RESOLVER,
  TEST_PROOF_RENDERER,
  testSignedArtifact,
} from "@repo/backend/test/content/proof";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import {
  renderSignedArtifact,
  renderVerifiedArtifact,
} from "@/lib/content/published/artifact";

const AUTHENTICATED_TREE = {
  $node: "element",
  children: [
    {
      $node: "element",
      children: [
        "Authenticated ",
        {
          $node: "element",
          children: ["lesson"],
          name: "strong",
          props: {},
        },
        " body.",
      ],
      name: "p",
      props: {},
    },
  ],
  name: "fragment",
  props: {},
} as const;

describe("authenticated artifact rendering", () => {
  it.effect(
    "authenticates a content tree and renders it with the real semantic components",
    () =>
      Effect.gen(function* () {
        const artifact = yield* testSignedArtifact("site", {
          contentTree: AUTHENTICATED_TREE,
          rawMdx: "Authenticated **lesson** body.",
        });
        const rendered = yield* renderSignedArtifact({
          artifact,
          rendererManifest: TEST_PROOF_RENDERER,
        }).pipe(
          Effect.provideService(
            ContentVerificationKeyResolver,
            TEST_KEY_RESOLVER
          )
        );

        expect(rendered.artifact).toEqual(artifact);
        const markup = renderToStaticMarkup(rendered.element);
        expect(markup).toContain("Authenticated <strong");
        expect(markup).toContain(">lesson</strong> body.");
      })
  );

  it.effect("rejects a changed content tree before it can render", () =>
    Effect.gen(function* () {
      const signed = yield* testSignedArtifact("site", {
        contentTree: AUTHENTICATED_TREE,
      });
      const failure = yield* renderSignedArtifact({
        artifact: {
          ...signed,
          payload: {
            ...signed.payload,
            contentTree: {
              $node: "element",
              children: ["Unverified body"],
              name: "fragment",
              props: {},
            },
          },
        },
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

  it.effect(
    "fails with the renderer's missing implementation for a component the artifact requires",
    () =>
      Effect.gen(function* () {
        const artifact = yield* testSignedArtifact("site", {
          requiredComponents: ["NoSuchComponent"],
        });
        const failure = yield* renderVerifiedArtifact({ artifact }).pipe(
          Effect.flip
        );
        expect(failure).toMatchObject({
          _tag: "RendererImplementationMissing",
          componentName: "NoSuchComponent",
          contentKey: artifact.payload.contentKey,
          rendererDomain: "site",
        });
      })
  );
});

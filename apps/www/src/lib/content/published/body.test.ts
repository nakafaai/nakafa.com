// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import type { ContentTreeElement } from "@nakafa/aksara-contracts/tree";
import { testSignedArtifact } from "@repo/backend/test/content/proof";
import { Array as Arr, Effect, Function as Fn } from "effect";
import { isValidElement, type ReactNode } from "react";
import { readRenderedBody } from "@/lib/content/published/body";

const renderServerComponentMock = vi.hoisted(() =>
  vi.fn<(element: unknown) => Promise<unknown>>()
);
const captureMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start/rsc", () => ({
  /** Controls the server markup that one body renders, or the render failure. */
  renderServerComponent: renderServerComponentMock,
}));

vi.mock("@/lib/analytics/exception.server", () => ({
  /** Records every body failure that the reader reports. */
  captureServerExceptionSafely: captureMock,
}));

const VERIFIED_BODY_TEXT = "Verified body";

/** One block of a body's root, by its element name and text. */
function block(name: string, text: string): ContentTreeElement {
  return { $node: "element", children: [text], name, props: {} };
}

/** A lesson of an introduction and four sections, each a heading and a paragraph. */
const SECTIONED_TREE: ContentTreeElement = {
  $node: "element",
  children: [
    block("p", "Introduction"),
    ...Arr.flatMap(["One", "Two", "Three", "Four"], (title) => [
      block("h2", title),
      block("p", `${title} body`),
    ]),
  ],
  name: "fragment",
  props: {},
};

/** The blocks that one body handed to its server render, in order. */
function renderedBlocks(): readonly unknown[] {
  const body = renderServerComponentMock.mock.calls[0]?.[0];
  if (!isValidElement<{ readonly children?: ReactNode }>(body)) {
    return [];
  }
  const { children } = body.props;
  return Arr.isArray(children) ? children : [children];
}

beforeEach(() => {
  renderServerComponentMock.mockReset().mockResolvedValue("server markup");
  captureMock.mockReset().mockReturnValue(Effect.void);
});

describe("published body reader", () => {
  it.effect("returns the server markup of a verified body", () =>
    Effect.gen(function* () {
      const artifact = yield* testSignedArtifact("site", {
        bodyText: VERIFIED_BODY_TEXT,
        rawMdx: VERIFIED_BODY_TEXT,
      });

      expect(yield* readRenderedBody(artifact, Fn.identity)).toBe(
        "server markup"
      );
      expect(renderServerComponentMock).toHaveBeenCalledOnce();
      expect(captureMock).not.toHaveBeenCalled();
    })
  );

  it.effect("renders the blocks as the page arranges them", () =>
    Effect.gen(function* () {
      const artifact = yield* testSignedArtifact("site", {
        contentTree: SECTIONED_TREE,
        rawMdx: "Introduction",
      });

      yield* readRenderedBody(artifact, (blocks) => Arr.take(blocks, 2));

      expect(renderedBlocks()).toHaveLength(2);
    })
  );

  it.effect(
    "fails with the renderer's missing implementation before any render starts",
    () =>
      Effect.gen(function* () {
        const artifact = yield* testSignedArtifact("site", {
          requiredComponents: ["NoSuchComponent"],
          rawMdx: "Broken body",
        });

        expect(
          yield* readRenderedBody(artifact, Fn.identity).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "RendererImplementationMissing",
          componentName: "NoSuchComponent",
          contentKey: artifact.payload.contentKey,
        });
        expect(captureMock).not.toHaveBeenCalled();
        expect(renderServerComponentMock).not.toHaveBeenCalled();
      })
  );

  it.effect("reports a render failure with its cause", () =>
    Effect.gen(function* () {
      const artifact = yield* testSignedArtifact("site", {
        bodyText: VERIFIED_BODY_TEXT,
        rawMdx: VERIFIED_BODY_TEXT,
      });
      const cause = new TypeError("render boom");
      renderServerComponentMock.mockRejectedValueOnce(cause);

      expect(
        yield* readRenderedBody(artifact, Fn.identity).pipe(Effect.flip)
      ).toMatchObject({
        _tag: "ContentExecutionError",
        contentKey: artifact.payload.contentKey,
        stage: "render",
      });
      expect(captureMock).toHaveBeenCalledWith(cause, {
        source: "content.body",
      });
    })
  );
});

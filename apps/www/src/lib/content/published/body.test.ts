// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { testSignedArtifact } from "@repo/backend/test/content/proof";
import { Effect } from "effect";
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

const VALID_BODY =
  'return { default: function Content() { return "Verified body"; } };';

beforeEach(() => {
  renderServerComponentMock.mockReset().mockResolvedValue("server markup");
  captureMock.mockReset().mockReturnValue(Effect.void);
});

describe("published body reader", () => {
  it.effect("returns the server markup of a verified body", () =>
    Effect.gen(function* () {
      const artifact = yield* testSignedArtifact("site", {
        compiledCode: VALID_BODY,
        rawMdx: "Verified body",
      });

      expect(yield* readRenderedBody(artifact)).toBe("server markup");
      expect(renderServerComponentMock).toHaveBeenCalledOnce();
      expect(captureMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "reports an evaluation failure with its cause and fails without it",
    () =>
      Effect.gen(function* () {
        const artifact = yield* testSignedArtifact("site", {
          compiledCode: "throw new TypeError('evaluation boom');",
          rawMdx: "Broken body",
        });

        expect(
          yield* readRenderedBody(artifact).pipe(Effect.flip)
        ).toMatchObject({
          _tag: "ContentExecutionError",
          contentKey: artifact.payload.contentKey,
          stage: "evaluate",
        });
        expect(captureMock).toHaveBeenCalledOnce();
        expect(renderServerComponentMock).not.toHaveBeenCalled();
      })
  );

  it.effect("reports a render failure with its cause", () =>
    Effect.gen(function* () {
      const artifact = yield* testSignedArtifact("site", {
        compiledCode: VALID_BODY,
        rawMdx: "Verified body",
      });
      const cause = new TypeError("render boom");
      renderServerComponentMock.mockRejectedValueOnce(cause);

      expect(yield* readRenderedBody(artifact).pipe(Effect.flip)).toMatchObject(
        {
          _tag: "ContentExecutionError",
          contentKey: artifact.payload.contentKey,
          stage: "evaluate",
        }
      );
      expect(captureMock).toHaveBeenCalledWith(cause, {
        source: "content.body",
      });
    })
  );
});

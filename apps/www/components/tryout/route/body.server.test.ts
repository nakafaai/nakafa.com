// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { renderToStaticMarkup } from "react-dom/server";
import { renderTryoutQuestionBody } from "@/components/tryout/route/body.server";

const render = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-start/rsc", () => ({
  renderServerComponent: render,
}));

describe("renderTryoutQuestionBody", () => {
  it.effect(
    "renders the body as one server component tree and keeps the question's identity",
    () =>
      Effect.gen(function* () {
        render.mockImplementation(async (tree: unknown) => tree);
        const question = {
          content: "Question body",
          contentHash: "hash-1",
          sourcePath: "try-out/indonesia/tka/set-1/question-1",
          sourceRevision: "revision-1",
        };

        const rendered = yield* Effect.promise(() =>
          renderTryoutQuestionBody(question)
        );

        expect(rendered).toMatchObject({
          contentHash: "hash-1",
          sourcePath: "try-out/indonesia/tka/set-1/question-1",
          sourceRevision: "revision-1",
        });
        expect(render).toHaveBeenCalledOnce();
        expect(renderToStaticMarkup(rendered.content)).toBe("Question body");
      })
  );
});

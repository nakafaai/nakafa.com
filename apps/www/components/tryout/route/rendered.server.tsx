import "@tanstack/react-start/server-only";

import { renderServerComponent } from "@tanstack/react-start/rsc";
import type { ReactNode } from "react";
import type { TryoutQuestionContent } from "@/components/tryout/content/model";
import { TryoutQuestionPreview } from "@/components/tryout/preview/server";
import { TryoutReview } from "@/components/tryout/review/server";
import type { QuestionPreviewContent } from "@/lib/content/preview/question";

/** Returns one question body as the single element that a server component tree takes. */
function TryoutQuestionBody({ body }: { readonly body: ReactNode }) {
  return body;
}

/**
 * Renders one signed question body of a running section as a server component tree.
 * The body crosses to the page as Flight data, so the route loader returns it and the
 * first HTML holds the question, as the featured question of the home page does.
 */
export async function renderTryoutQuestionBody(
  question: TryoutQuestionContent
) {
  return {
    ...question,
    content: await renderServerComponent(
      <TryoutQuestionBody body={question.content} />
    ),
  };
}

/**
 * Renders the terminal review of one finished attempt as a server component tree.
 * The tree crosses to the page as Flight data, so the review's question bodies
 * stay on the server and the route loader can return it, as the reference page
 * renders its review inside the set page.
 */
export function renderTryoutReview(props: Parameters<typeof TryoutReview>[0]) {
  return renderServerComponent(<TryoutReview {...props} />);
}

/**
 * Renders one authenticated question preview on its real public route as a server
 * component tree, which the route returns in place of the set or section page.
 */
export function renderTryoutPreview(content: QuestionPreviewContent) {
  return renderServerComponent(<TryoutQuestionPreview content={content} />);
}

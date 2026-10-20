import { renderServerComponent } from "@tanstack/react-start/rsc";
import { createElement, type ReactNode } from "react";
import type { TryoutQuestionContent } from "@/components/tryout/content/model";

/** Returns one question body as the single element that a server component tree takes. */
function TryoutQuestionBody({ body }: { readonly body: ReactNode }) {
  return body;
}

/**
 * Renders one signed question body of a running section as a server component
 * tree. The body crosses to the page as Flight data, so the route loader returns
 * it and the first HTML holds the question, as the featured question does.
 */
export async function renderTryoutQuestionBody(
  question: TryoutQuestionContent
) {
  return {
    ...question,
    content: await renderServerComponent(
      createElement(TryoutQuestionBody, { body: question.content })
    ),
  };
}

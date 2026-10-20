import { renderServerComponent } from "@tanstack/react-start/rsc";
import { TryoutQuestionPreview } from "@/components/tryout/preview/question.server";
import { TryoutReview } from "@/components/tryout/review/screen.server";
import type { QuestionPreviewContent } from "@/lib/content/preview/question";

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

import { Option } from "effect";
import { findArticle } from "@/components/player/article";

/** Selects the sidebar, which `PlayerSidebar` marks with this attribute. */
const SIDEBAR_SELECTOR = "[data-player-sidebar]";

/** Moves focus to the current number of the sidebar. */
export function focusNavigator() {
  document
    .querySelector<HTMLElement>(`${SIDEBAR_SELECTOR} [aria-current="step"]`)
    ?.focus();
}

/** Whether focus is inside the sidebar. */
export function isFocusInNavigator() {
  return Boolean(document.activeElement?.closest(SIDEBAR_SELECTOR));
}

/** Moves focus back to a question, where the learner was reading, without scrolling the page. */
export function focusQuestion(key: string | null) {
  if (key === null) {
    return;
  }
  const article = findArticle(document, key);
  if (Option.isSome(article)) {
    article.value.focus({ preventScroll: true });
  }
}

import { LESSON_SECTION_ID } from "@/components/marketing/about/lesson/id";

/**
 * Scrolls the lesson section into view on its own, smoothly unless the reader
 * asked for less motion. The page no longer smooths every hash jump, so the
 * header's Features link brings its own smooth scroll on the home page.
 */
export function scrollToLessonSection() {
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  document.getElementById(LESSON_SECTION_ID)?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

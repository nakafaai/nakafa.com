import { isCalm } from "@repo/design-system/lib/calm";
import { elementById } from "@repo/design-system/lib/element";
import { Array as Arr } from "effect";

/** Scrolls a question's explanation section into view once its collapsible panel opens. */
export function scrollExplanationIntoView(explanationId: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const section = elementById(explanationId);
      if (section === null) {
        return;
      }
      const behavior: ScrollBehavior = isCalm() ? "auto" : "smooth";
      const panel = section.parentElement;
      const animations =
        panel !== null && typeof panel.getAnimations === "function"
          ? panel.getAnimations()
          : [];
      if (animations.length === 0) {
        section.scrollIntoView({ behavior, block: "start" });
        return;
      }
      Promise.allSettled(
        Arr.map(animations, (animation) => animation.finished)
      ).then(() => {
        if (section.isConnected && panel?.hasAttribute("data-open")) {
          section.scrollIntoView({ behavior, block: "start" });
        }
      });
    });
  });
}

import {
  type NinaTurn,
  readNinaLearningPage,
} from "@repo/ai/nina/contract/turn";
import type { LogContext } from "@repo/utilities/logging/types";

/** Builds structured log annotations from schema-derived turn data. */
export function createNinaLogContext(turn: NinaTurn): LogContext {
  const learningPage = readNinaLearningPage(turn.page);

  return {
    service: "nina-harness",
    currentDate: turn.runtime.currentDate,
    currentPage: {
      locale: learningPage.locale,
      slug: learningPage.slug,
      url: learningPage.url,
      verified: learningPage.verified,
    },
    ninaContext: turn.page.nina.snapshot,
    userLocation: turn.user.location,
    userRole: turn.user.role,
    url: learningPage.url,
  };
}

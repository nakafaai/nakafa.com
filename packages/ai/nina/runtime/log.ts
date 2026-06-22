import type { NinaTurn } from "@repo/ai/nina/contract/turn";
import type { LogContext } from "@repo/utilities/logging/types";

/** Builds structured log annotations from schema-derived turn data. */
export function createNinaLogContext(turn: NinaTurn): LogContext {
  return {
    service: "nina-harness",
    currentDate: turn.runtime.currentDate,
    currentPage: {
      locale: turn.page.locale,
      slug: turn.page.slug,
      url: turn.page.url,
      verified: turn.page.verified,
    },
    ninaContext: turn.page.nina.snapshot,
    userLocation: turn.user.location,
    userRole: turn.user.role,
    url: turn.page.url,
  };
}

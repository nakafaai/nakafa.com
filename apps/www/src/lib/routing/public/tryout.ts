import { Effect, Option } from "effect";
import { readGroupRedirect } from "@/lib/routing/public/tryout/group";
import { readHubRedirect } from "@/lib/routing/public/tryout/hub";
import {
  readRetiredSnbtExam,
  readRetiredSnbtExamRedirect,
  readRetiredSnbtProduct,
  readRetiredSnbtProductRedirect,
} from "@/lib/routing/public/tryout/product";
import { readRenamedExamRedirect } from "@/lib/routing/public/tryout/renamed";
import { readRetiredSectionRedirect } from "@/lib/routing/public/tryout/section";
import {
  readTracklessRouteRedirect,
  readTracklessSetRoute,
} from "@/lib/routing/public/tryout/trackless";

/**
 * Resolves one retired try-out URL to its live successor, with the status that
 * answers it. Each rule keeps the retired path absent and the successor live,
 * so a redirect never lands on a page that the signed catalog does not serve.
 * The track-less rules and the entries of "Try out", an exam and a single-track
 * group answer 307, because their newest live year, first group, one option or
 * reader's country can change; every other try-out rule answers 308.
 */
export const readTryoutRedirect = Effect.fn(
  "www.routing.publicHtml.tryoutRedirect"
)(function* (pathname: string) {
  const sectionRedirect = yield* readRetiredSectionRedirect(pathname);
  if (sectionRedirect !== null) {
    return sectionRedirect;
  }
  const exam = readRetiredSnbtExam(pathname);
  if (Option.isSome(exam)) {
    return yield* readRetiredSnbtExamRedirect(exam.value);
  }
  const product = readRetiredSnbtProduct(pathname);
  if (Option.isSome(product)) {
    return yield* readRetiredSnbtProductRedirect(product.value);
  }
  const trackless = readTracklessSetRoute(pathname);
  if (Option.isSome(trackless)) {
    return yield* readTracklessRouteRedirect(trackless.value);
  }
  const renamed = yield* readRenamedExamRedirect(pathname);
  if (renamed !== null) {
    return renamed;
  }
  const hub = yield* readHubRedirect(pathname);
  if (hub !== null) {
    return hub;
  }
  return yield* readGroupRedirect(pathname);
});

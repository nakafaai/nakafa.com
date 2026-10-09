import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";
import type { RetainedSectionAttemptPage } from "@/components/tryout/section/model";
import type {
  SetPage,
  TryoutSetRestartTarget,
} from "@/components/tryout/set/model";

/** Builds the current restart target exposed by one public set page. */
export function createTryoutSetRestartTarget<EntrySection>(page: {
  readonly entrySection: EntrySection | null;
  readonly set: Pick<SetPage["set"], "publicPath">;
}) {
  if (!page.entrySection) {
    return null;
  }

  return {
    entrySection: page.entrySection,
    setPublicPath: page.set.publicPath,
  };
}

/**
 * Selects the active set route and its parent track for one current or
 * retained set, or the try-out root when the set is no longer active.
 */
export function selectTryoutSetLinks(
  restartTarget: Pick<TryoutSetRestartTarget, "setPublicPath"> | null
) {
  if (!restartTarget) {
    return { currentHref: getTryoutHref(), returnHref: getTryoutHref() };
  }

  const currentHref = getTryoutPublicPathHref(restartTarget.setPublicPath);
  const separator = restartTarget.setPublicPath.lastIndexOf("/");
  if (separator <= 0) {
    return { currentHref, returnHref: getTryoutHref() };
  }

  return {
    currentHref,
    returnHref: getTryoutPublicPathHref(
      restartTarget.setPublicPath.slice(0, separator)
    ),
  };
}

/** Selects the active set destination for one retained section. */
export function selectTryoutSectionReturnHref({
  attemptPage,
  publicHref,
}: {
  attemptPage: Pick<
    RetainedSectionAttemptPage,
    "activeSetPublicPath" | "kind"
  > | null;
  publicHref: string;
}) {
  if (!attemptPage) {
    return publicHref;
  }

  if (!attemptPage.activeSetPublicPath) {
    return getTryoutHref();
  }

  return getTryoutPublicPathHref(attemptPage.activeSetPublicPath);
}

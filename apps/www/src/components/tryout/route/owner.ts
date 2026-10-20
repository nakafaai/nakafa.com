import { Option } from "effect";
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
    return Option.none();
  }

  return Option.some({
    entrySection: page.entrySection,
    setPublicPath: page.set.publicPath,
  });
}

/**
 * Selects the active set route and its parent track for one current or
 * retained set, or the try-out root when the set is no longer active.
 */
export function selectTryoutSetLinks(
  restartTarget: Option.Option<Pick<TryoutSetRestartTarget, "setPublicPath">>
) {
  if (Option.isNone(restartTarget)) {
    return { currentHref: getTryoutHref(), returnHref: getTryoutHref() };
  }

  const { setPublicPath } = restartTarget.value;
  const currentHref = getTryoutPublicPathHref(setPublicPath);
  const separator = setPublicPath.lastIndexOf("/");
  if (separator <= 0) {
    return { currentHref, returnHref: getTryoutHref() };
  }

  return {
    currentHref,
    returnHref: getTryoutPublicPathHref(setPublicPath.slice(0, separator)),
  };
}

/** Selects the active set destination for one retained section. */
export function selectTryoutSectionReturnHref({
  attemptPage,
  publicHref,
}: {
  attemptPage: Option.Option<
    Pick<RetainedSectionAttemptPage, "activeSetPublicPath" | "kind">
  >;
  publicHref: string;
}) {
  if (Option.isNone(attemptPage)) {
    return publicHref;
  }

  const { activeSetPublicPath } = attemptPage.value;
  if (!activeSetPublicPath) {
    return getTryoutHref();
  }

  return getTryoutPublicPathHref(activeSetPublicPath);
}

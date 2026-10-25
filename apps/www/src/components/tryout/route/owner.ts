import { Option } from "effect";
import type { RetainedSectionAttemptPage } from "@/components/tryout/section/model";
import type {
  SetPage,
  TryoutSetRestartTarget,
} from "@/components/tryout/set/model";

/** The public path of the try-out catalog, which every try-out path starts from. */
const TRYOUT_ROOT_PATH = "try-out";

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
 * Selects the active set path and its parent track path for one current or
 * retained set, or the try-out root when the set is no longer active.
 */
export function selectTryoutSetLinks(
  restartTarget: Option.Option<Pick<TryoutSetRestartTarget, "setPublicPath">>
) {
  if (Option.isNone(restartTarget)) {
    return { currentPath: TRYOUT_ROOT_PATH, returnPath: TRYOUT_ROOT_PATH };
  }

  const { setPublicPath } = restartTarget.value;
  const separator = setPublicPath.lastIndexOf("/");
  if (separator <= 0) {
    return { currentPath: setPublicPath, returnPath: TRYOUT_ROOT_PATH };
  }

  return {
    currentPath: setPublicPath,
    returnPath: setPublicPath.slice(0, separator),
  };
}

/** Selects the active set path for one retained section. */
export function selectTryoutSectionReturnPath({
  attemptPage,
  publicPath,
}: {
  attemptPage: Option.Option<
    Pick<RetainedSectionAttemptPage, "activeSetPublicPath" | "kind">
  >;
  publicPath: string;
}) {
  if (Option.isNone(attemptPage)) {
    return publicPath;
  }

  const { activeSetPublicPath } = attemptPage.value;
  if (!activeSetPublicPath) {
    return TRYOUT_ROOT_PATH;
  }

  return activeSetPublicPath;
}

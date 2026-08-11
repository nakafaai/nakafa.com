import {
  getTryoutHref,
  getTryoutPublicPathHref,
} from "@/components/tryout/route/path";

interface FrozenAttemptPage<FrozenPage> {
  readonly kind: "current" | "retained";
  readonly page: FrozenPage;
}

interface SetAttemptPage<FrozenPage, RestartTarget> {
  readonly kind: "current" | "retained";
  readonly page: FrozenPage;
  readonly restartTarget: RestartTarget | null;
}

interface RedirectAttemptPage {
  readonly kind: "redirect";
}

/** Selects the verified snapshot page carried by a current or retained attempt. */
export function selectTryoutFrozenPage<FrozenPage>(
  attemptPage: FrozenAttemptPage<FrozenPage> | RedirectAttemptPage | null
) {
  if (!attemptPage || attemptPage.kind === "redirect") {
    return null;
  }

  return attemptPage.page;
}

/** Builds the current restart target exposed by one public set page. */
export function createTryoutSetRestartTarget<EntrySection>(page: {
  readonly entrySection: EntrySection | null;
  readonly set: { readonly publicPath: string };
}) {
  if (!page.entrySection) {
    return null;
  }

  return {
    entrySection: page.entrySection,
    setPublicPath: page.set.publicPath,
  };
}

/** Separates frozen attempt display from the verified current restart target. */
export function selectTryoutSetPages<PublicPage, FrozenPage, RestartTarget>({
  attemptPage,
  publicPage,
  publicRestartTarget,
}: {
  attemptPage:
    | SetAttemptPage<FrozenPage, RestartTarget>
    | RedirectAttemptPage
    | null;
  publicPage: PublicPage | null;
  publicRestartTarget: RestartTarget | null;
}) {
  const page = selectTryoutFrozenPage(attemptPage) ?? publicPage;
  if (page === null) {
    return null;
  }

  const restartTarget =
    attemptPage && attemptPage.kind !== "redirect"
      ? attemptPage.restartTarget
      : publicRestartTarget;

  return {
    page,
    restartTarget,
  };
}

/** Selects the active parent track for one current or retained set. */
export function selectTryoutTrackReturnHref(
  restartTarget: {
    readonly setPublicPath: string;
  } | null
) {
  if (!restartTarget) {
    return getTryoutHref();
  }

  const separator = restartTarget.setPublicPath.lastIndexOf("/");
  if (separator <= 0) {
    return getTryoutHref();
  }

  return getTryoutPublicPathHref(
    restartTarget.setPublicPath.slice(0, separator)
  );
}

/** Selects the active set destination for one retained section. */
export function selectTryoutSectionReturnHref({
  attemptPage,
  publicHref,
}: {
  attemptPage: {
    readonly activeSetPublicPath: string | null;
    readonly kind: "retained";
  } | null;
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

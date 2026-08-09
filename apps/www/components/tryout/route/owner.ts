import { getTryoutAttemptHref } from "@/components/tryout/route/path";

interface FrozenAttemptPage<FrozenPage> {
  readonly kind: "current" | "retained";
  readonly page: FrozenPage;
}

interface CurrentAttemptPage<FrozenPage> {
  readonly kind: "current";
  readonly page: FrozenPage;
}

interface RetainedAttemptPage<FrozenPage, RestartTarget> {
  readonly kind: "retained";
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
    | CurrentAttemptPage<FrozenPage>
    | RetainedAttemptPage<FrozenPage, RestartTarget>
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
    attemptPage?.kind === "retained"
      ? attemptPage.restartTarget
      : publicRestartTarget;

  return {
    page,
    restartTarget,
  };
}

/** Keeps an exact retained section's return link on its frozen set route. */
export function selectTryoutSetReturnHref({
  attemptPage,
  publicHref,
}: {
  attemptPage: {
    readonly attemptId: string;
    readonly kind: "retained";
    readonly page: { readonly set: { readonly publicPath: string } };
  } | null;
  publicHref: string;
}) {
  if (!attemptPage) {
    return publicHref;
  }

  return getTryoutAttemptHref(
    attemptPage.page.set.publicPath,
    attemptPage.attemptId
  );
}

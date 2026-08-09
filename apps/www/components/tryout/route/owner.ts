import { getTryoutAttemptHref } from "@/components/tryout/route/path";

interface FrozenAttemptPage<FrozenPage> {
  readonly kind: "current" | "retained";
  readonly page: FrozenPage;
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

/** Separates frozen attempt display from the active page used for a new start. */
export function selectTryoutSetPages<PublicPage, FrozenPage>({
  attemptPage,
  publicPage,
}: {
  attemptPage: FrozenAttemptPage<FrozenPage> | RedirectAttemptPage | null;
  publicPage: PublicPage | null;
}) {
  const page = selectTryoutFrozenPage(attemptPage) ?? publicPage;
  if (page === null) {
    return null;
  }

  return {
    page,
    startPage: publicPage ?? page,
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

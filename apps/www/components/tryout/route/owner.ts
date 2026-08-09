import { getTryoutAttemptHref } from "@/components/tryout/route/path";

interface CurrentAttemptPage {
  readonly kind: "current";
}

interface RetainedAttemptPage<RetainedPage> {
  readonly kind: "retained";
  readonly page: RetainedPage;
}

interface RedirectAttemptPage {
  readonly kind: "redirect";
}

/** Keeps canonical routes public while exact capabilities own frozen pages. */
export function selectTryoutBasePage<PublicPage, RetainedPage>({
  attemptPage,
  publicPage,
}: {
  attemptPage:
    | CurrentAttemptPage
    | RedirectAttemptPage
    | RetainedAttemptPage<RetainedPage>
    | null;
  publicPage: PublicPage | null;
}) {
  if (attemptPage?.kind === "retained") {
    return attemptPage.page;
  }
  return publicPage;
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

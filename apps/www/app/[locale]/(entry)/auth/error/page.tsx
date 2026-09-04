import { redirect } from "@repo/internationalization/src/navigation";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  getPostAuthProviderRetryHref,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type AuthErrorPageProps = PageProps<"/[locale]/auth/error">;

/** Discards raw provider diagnostics before showing one generic retry state. */
async function RedirectFromAuthError(props: AuthErrorPageProps) {
  const [{ locale: rawLocale }, query] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const locale = getLocaleOrThrow(rawLocale);
  if (!isActiveLocale(locale)) {
    notFound();
  }

  const intent = resolvePostAuthIntent(query.intent, locale);
  redirect({ href: getPostAuthProviderRetryHref(intent), locale });
  return null;
}

export default function Page(props: AuthErrorPageProps) {
  return (
    <Suspense fallback={null}>
      <RedirectFromAuthError {...props} />
    </Suspense>
  );
}

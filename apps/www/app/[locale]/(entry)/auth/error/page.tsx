import { redirect } from "@repo/internationalization/src/navigation";
import { notFound } from "next/navigation";
import {
  getPostAuthProviderRetryHref,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Discards raw provider diagnostics before showing one generic retry state. */
export default async function Page(props: PageProps<"/[locale]/auth/error">) {
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
}

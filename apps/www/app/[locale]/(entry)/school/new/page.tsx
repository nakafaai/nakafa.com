import { Nina } from "@repo/design-system/components/ui/nina";
import { redirect } from "@repo/internationalization/src/navigation";
import { SITE_ORIGIN } from "@repo/seo/origin";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { EntryShellBody, EntryShellHeader } from "@/components/entry/shell";
import { ThemePicker } from "@/components/shared/theme/picker";
import { SchoolStart } from "@/components/tenant/start/questionnaire";
import {
  getPostAuthSignInHref,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { getToken } from "@/lib/auth/server";
import { getShellPageNavigation } from "@/lib/content/page/navigation";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Builds the localized metadata of the page where an account opens its own school. */
export async function generateMetadata({
  params,
}: {
  params: PageProps<"/[locale]/school/new">["params"];
}): Promise<Metadata> {
  const locale = getLocaleOrThrow((await params).locale);
  const t = await getTranslations({ locale, namespace: "SchoolStart" });
  return {
    description: t("metadata-description"),
    robots: { follow: false, index: false },
    title: t("metadata-title"),
  };
}

/**
 * The page where anyone opens a Nakafa School by answering five questions
 * (K42), the one link the founder sends to a school (K43). It sits in the entry
 * frame, as the learner questionnaire does.
 */
export default function Page(props: PageProps<"/[locale]/school/new">) {
  return (
    <>
      <EntryShellHeader>
        <div className="ms-auto">
          <ThemePicker variant="ghost" />
        </div>
      </EntryShellHeader>
      <Suspense fallback={null}>
        <SignedInStart params={props.params} />
      </Suspense>
    </>
  );
}

/**
 * Sends a visitor without a session to sign in, and back here after it, then
 * mounts the questionnaire with the policy pages its last question links to.
 */
async function SignedInStart({
  params,
}: {
  params: PageProps<"/[locale]/school/new">["params"];
}) {
  const [{ locale: rawLocale }, token] = await Promise.all([
    params,
    getToken(),
  ]);
  const locale = getLocaleOrThrow(rawLocale);
  if (!isActiveLocale(locale)) {
    notFound();
  }
  if (!token) {
    redirect({
      href: getPostAuthSignInHref(
        resolvePostAuthIntent(`/${locale}/school/new`, locale)
      ),
      locale,
    });
    return null;
  }
  const pages = await getShellPageNavigation(locale);

  return (
    <EntryShellBody>
      <SchoolStart
        legal={
          pages
            ? {
                privacy: new URL(
                  `/${locale}${pages.privacyPolicyHref}`,
                  SITE_ORIGIN
                ).href,
                terms: new URL(
                  `/${locale}${pages.termsOfServiceHref}`,
                  SITE_ORIGIN
                ).href,
              }
            : null
        }
      >
        <Nina act="waving" label="" size={120} whole />
      </SchoolStart>
    </EntryShellBody>
  );
}

import { redirect } from "@repo/internationalization/src/navigation";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdmissionPending } from "@/components/auth/pending";
import {
  getPostAuthDestination,
  getPostAuthOnboardingHref,
  getPostAuthSignInHref,
  resolvePostAuthIntent,
} from "@/lib/auth/admission";
import { getToken } from "@/lib/auth/server";
import { isActiveLocale } from "@/lib/i18n/active";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { recordOnboardingAdmission } from "@/lib/onboarding/server";

/** Routes a completed authentication through authoritative first-run state. */
export default function Page(props: PageProps<"/[locale]/auth/continue">) {
  return (
    <Suspense fallback={<AdmissionPending />}>
      <PostAuthAdmission
        params={props.params}
        searchParams={props.searchParams}
      />
    </Suspense>
  );
}

/** Performs the database-backed admission at the post-auth request seam. */
async function PostAuthAdmission({
  params,
  searchParams,
}: {
  params: PageProps<"/[locale]/auth/continue">["params"];
  searchParams: PageProps<"/[locale]/auth/continue">["searchParams"];
}) {
  const [{ locale: rawLocale }, query, token] = await Promise.all([
    params,
    searchParams,
    getToken(),
  ]);
  const locale = getLocaleOrThrow(rawLocale);
  if (!isActiveLocale(locale)) {
    notFound();
  }

  const intent = resolvePostAuthIntent(query.intent, locale);
  if (!token) {
    redirect({ href: getPostAuthSignInHref(intent), locale });
    return null;
  }

  const admission = await Effect.runPromise(recordOnboardingAdmission(token));
  if (!admission.isAuthenticated) {
    redirect({ href: getPostAuthSignInHref(intent), locale });
    return null;
  }
  if (admission.isRequired) {
    redirect({ href: getPostAuthOnboardingHref(intent), locale });
    return null;
  }

  const destination = getPostAuthDestination(intent, locale);
  redirect(destination);
  return null;
}

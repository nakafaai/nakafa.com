import { redirect } from "@repo/internationalization/src/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/** Redirects an in-flight legacy onboarding tab to the replacement flow. */
export default async function Page({
  params,
}: PageProps<"/[locale]/onboarding/role">) {
  const locale = getLocaleOrThrow((await params).locale);
  redirect({ href: "/onboarding", locale });
}

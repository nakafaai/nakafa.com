import { Suspense } from "react";
import { School } from "@/components/school";
import { SchoolAuthScreen } from "@/components/school/auth-screen";
import { getLocaleOrThrow } from "@/lib/i18n/params";

/**
 * Resolve the school entry experience.
 *
 * Authenticated users are redirected into their school flow by `School`, while
 * unauthenticated users see the shared Nakafa School sign-in screen.
 */
export default async function Page(props: PageProps<"/[locale]/school">) {
  const locale = getLocaleOrThrow((await props.params).locale);

  return (
    <Suspense fallback={null}>
      <School locale={locale}>
        <SchoolAuthScreen />
      </School>
    </Suspense>
  );
}

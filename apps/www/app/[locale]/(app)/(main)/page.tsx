import { Particles } from "@repo/design-system/components/ui/particles";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { redirect } from "next/navigation";
import { type Locale, useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { HomeHeader } from "@/components/home/header";
import { HomeTrending } from "@/components/home/trending";
import { getToken } from "@/lib/auth/server";

export const revalidate = false;

interface Props {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ from: string }>;
}

export default function Page({ params, searchParams }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <>
      <PageBreadcrumb locale={locale} />
      <div
        className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center lg:min-h-svh"
        data-pagefind-ignore
      >
        <Particles className="pointer-events-none absolute inset-0 opacity-50" />
        <Suspense>
          <Main searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function Main({
  searchParams,
}: {
  searchParams: Promise<{ from: string }>;
}) {
  const [{ from }, token] = await Promise.all([searchParams, getToken()]);

  // If no user token and from about page, goes to auth
  if (!token && from === "/about") {
    redirect("/auth");
  }

  // if just no user token
  if (!token) {
    redirect("/about");
  }

  return (
    <div className="mx-auto w-full max-w-xl px-6">
      <div className="relative flex-col space-y-4">
        <HomeHeader />

        <HomeTrending />
      </div>
    </div>
  );
}

function PageBreadcrumb({ locale }: { locale: Locale }) {
  const tHome = useTranslations("Home");
  const tCommon = useTranslations("Common");

  return (
    <BreadcrumbJsonLd
      breadcrumbItems={[
        {
          "@type": "ListItem",
          position: 1,
          name: tHome("title"),
          item: `https://nakafa.com/${locale}`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: tCommon("subject"),
          item: `https://nakafa.com/${locale}/subject`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: tCommon("articles"),
          item: `https://nakafa.com/${locale}/articles`,
        },
        {
          "@type": "ListItem",
          position: 4,
          name: tCommon("contributor"),
          item: `https://nakafa.com/${locale}/contributor`,
        },
      ]}
    />
  );
}

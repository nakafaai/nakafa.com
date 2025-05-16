import { LangSwitcher } from "@/components/home/lang-switcher";
import { BreadcrumbJsonLd } from "@/components/json-ld/breadcrumb";
import { SearchBar } from "@/components/sidebar/search-bar";
import { buttonVariants } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { cn } from "@/lib/utils";
import { IconBrandYoutube } from "@tabler/icons-react";
import { HeartHandshakeIcon } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;

  // const t = await getTranslations("Home");
  const [tHome, tCommon] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
  ]);

  setRequestLocale(locale);

  return (
    <Suspense fallback={null}>
      <BreadcrumbJsonLd
        locale={locale}
        breadcrumbItems={[
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}`,
            position: 1,
            name: tHome("title"),
            item: `https://nakafa.com/${locale}`,
          },
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}/subject`,
            position: 2,
            name: tCommon("subject"),
            item: `https://nakafa.com/${locale}/subject`,
          },
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}/articles`,
            position: 3,
            name: tCommon("articles"),
            item: `https://nakafa.com/${locale}/articles`,
          },
          {
            "@type": "ListItem",
            "@id": `https://nakafa.com/${locale}/contributor`,
            position: 4,
            name: tCommon("contributor"),
            item: `https://nakafa.com/${locale}/contributor`,
          },
        ]}
      />
      <div
        data-pagefind-ignore
        className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh"
      >
        <Particles className="pointer-events-none absolute inset-0 opacity-80" />
        <div className="mx-auto w-full max-w-xl px-6">
          <div className="relative flex h-full flex-col">
            <h1 className="mb-8 font-medium text-4xl leading-none tracking-tighter md:text-center">
              {tHome("title")}
            </h1>

            <SearchBar className="h-12 sm:w-full" />

            <div className="mt-4 flex justify-between gap-6 gap-y-3 sm:items-center">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  href="https://github.com/nabilfatih/nakafa.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  <HeartHandshakeIcon className="size-4" />
                  {tHome("contribute")}
                </a>
                <a
                  href="https://www.youtube.com/@nakafaa"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  <IconBrandYoutube className="size-4" />
                  {tHome("videos")}
                </a>
              </div>

              <LangSwitcher />
            </div>
          </div>
        </div>
      </div>
    </Suspense>
  );
}

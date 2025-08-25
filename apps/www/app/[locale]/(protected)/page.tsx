import { SiYoutube } from "@icons-pack/react-simple-icons";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import { Particles } from "@repo/design-system/components/ui/particles";
import { cn } from "@repo/design-system/lib/utils";
import { BreadcrumbJsonLd } from "@repo/seo/json-ld/breadcrumb";
import { HeartHandshakeIcon } from "lucide-react";
import type { Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LangSwitcher } from "@/components/home/lang-switcher";
import { HomeSearch } from "@/components/home/search";
import { HomeTitle } from "@/components/home/title";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;

  const [tHome, tCommon] = await Promise.all([
    getTranslations("Home"),
    getTranslations("Common"),
  ]);

  setRequestLocale(locale);

  return (
    <>
      <BreadcrumbJsonLd
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
        locale={locale}
      />
      <div
        className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh"
        data-pagefind-ignore
      >
        <Particles className="pointer-events-none absolute inset-0 opacity-80" />
        <div className="mx-auto w-full max-w-xl px-6">
          <div className="relative flex h-full flex-col">
            <HomeTitle />

            <HomeSearch />

            <div className="mt-4 flex justify-between gap-6 gap-y-3 sm:items-center">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <a
                  className={cn(buttonVariants({ variant: "outline" }))}
                  href="https://github.com/nakafaai/nakafa.com"
                  rel="noopener noreferrer"
                  target="_blank"
                  title={tHome("contribute")}
                >
                  <HeartHandshakeIcon className="size-4" />
                  {tHome("contribute")}
                </a>
                <a
                  className={cn(buttonVariants({ variant: "outline" }))}
                  href="https://www.youtube.com/@nakafaa"
                  rel="noopener noreferrer"
                  target="_blank"
                  title={tHome("videos")}
                >
                  <SiYoutube className="size-4" />
                  {tHome("videos")}
                </a>
              </div>

              <LangSwitcher />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

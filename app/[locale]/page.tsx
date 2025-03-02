import { SearchBar } from "@/components/sidebar/search-bar";
import { buttonVariants } from "@/components/ui/button";
import { Particles } from "@/components/ui/particles";
import { cn } from "@/lib/utils";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function IndexPage({ params }: Props) {
  const { locale } = await params;

  const t = await getTranslations("Home");

  setRequestLocale(locale);

  return (
    <div
      data-pagefind-ignore
      className="relative flex h-[calc(100dvh-4rem)] flex-1"
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-50" />
      <div className="mx-auto w-full max-w-xl flex-1 px-4">
        <div className="relative flex h-full flex-1 flex-col pt-16 sm:pt-64">
          <h1 className="mb-8 font-medium text-4xl leading-none tracking-tighter sm:text-center">
            {t("title")}
          </h1>
          <SearchBar
            forceOpen
            autoFocus
            className="h-12 rounded-xl border-primary/10 sm:w-full"
          />

          <a
            href="https://github.com/nabilfatih/nakafa.com"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "mt-6 w-fit sm:mx-auto"
            )}
          >
            {t("contribute")}
          </a>
        </div>
      </div>
    </div>
  );
}

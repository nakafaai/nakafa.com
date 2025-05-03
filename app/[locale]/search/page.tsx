import { SearchInput } from "@/components/search/input";
import { SearchResults } from "@/components/search/results";
import { useTranslations } from "next-intl";

export default function Page() {
  const t = useTranslations("Home");

  return (
    <div data-pagefind-ignore className="relative py-10 sm:py-26">
      <div className="mx-auto w-full max-w-xl px-6">
        <h1 className="mb-8 font-medium text-4xl leading-none tracking-tighter md:text-center">
          {t("title")}
        </h1>
      </div>
      <div className="sticky top-20 z-10 bg-background/60 backdrop-blur-sm sm:top-10">
        <div className="mx-auto w-full max-w-xl px-6">
          <SearchInput />
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-xl px-6">
        <div className="flex flex-col gap-4">
          <SearchResults />
        </div>
      </div>
    </div>
  );
}

import { HomeTitle } from "@/components/home/title";
import { InputSearch } from "@/components/search/input";
import { SearchResults } from "@/components/search/results";
import { FooterContent } from "@/components/shared/footer-content";
import { RefContent } from "@/components/shared/ref-content";
import { getGithubUrl } from "@/lib/utils/github";

export const revalidate = false;

export default function Page() {
  return (
    <>
      <div
        data-pagefind-ignore
        className="relative min-h-[calc(100svh-4rem)] py-10 lg:min-h-svh lg:border-t lg:py-26"
      >
        <div className="mx-auto w-full max-w-xl px-6">
          <HomeTitle />
        </div>
        <div className="sticky top-20 z-10 sm:top-10">
          <div className="mx-auto w-full max-w-xl px-6">
            <InputSearch />
          </div>
        </div>
        <div className="mx-auto mt-8 w-full max-w-xl px-6">
          <SearchResults />
        </div>
      </div>
      <FooterContent className="mt-0">
        <RefContent
          githubUrl={getGithubUrl(encodeURI("/app/[locale]/search"))}
        />
      </FooterContent>
    </>
  );
}

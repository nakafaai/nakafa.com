import { redirect } from "@repo/internationalization/src/navigation";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeTrending } from "@/components/home/trending";
import { getToken } from "@/lib/auth/server";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default async function Page(props: PageProps<"/[locale]/home">) {
  const [{ locale: rawLocale }, token] = await Promise.all([
    props.params,
    getToken(),
  ]);
  const locale = getLocaleOrThrow(rawLocale);

  if (!token) {
    redirect({ href: "/auth", locale });
  }

  return (
    <div className="relative min-h-[calc(100svh-4rem)] lg:min-h-svh">
      <Main />
    </div>
  );
}

function Main() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-24">
      <div className="relative space-y-12">
        <HomeHeader />

        <HomeExplore />

        <HomeContinueLearning />

        <HomeTrending />
      </div>
    </div>
  );
}

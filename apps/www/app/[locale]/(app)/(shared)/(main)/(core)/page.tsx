import { redirect } from "next/navigation";
import { HomeContinueLearning } from "@/components/home/continue-learning";
import { HomeExplore } from "@/components/home/explore";
import { HomeHeader } from "@/components/home/header";
import { HomeTrending } from "@/components/home/trending";
import { getToken } from "@/lib/auth/server";

export default async function Page(props: PageProps<"/[locale]">) {
  const { searchParams } = props;
  const [searchParamsValue, token] = await Promise.all([
    searchParams,
    getToken(),
  ]);
  const from =
    typeof searchParamsValue?.from === "string"
      ? searchParamsValue.from
      : undefined;

  // If no user token and from about page, goes to auth
  if (!token && from === "/about") {
    redirect("/auth");
  }

  // if just no user token
  if (!token) {
    redirect("/about");
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

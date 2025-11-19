import { Particles } from "@repo/design-system/components/ui/particles";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { FinanceSearch } from "@/components/finance/search";
import { FinanceSearchTitle } from "@/components/finance/search-title";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <div className="relative flex min-h-svh items-center justify-center">
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto w-full max-w-xl px-6">
        <div className="relative flex h-full flex-col space-y-4">
          <FinanceSearchTitle />
          <FinanceSearch />
        </div>
      </div>
    </div>
  );
}

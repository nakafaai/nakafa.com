import { Particles } from "@repo/design-system/components/ui/particles";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { School } from "@/components/school";
import { SchoolLoader } from "@/components/school/loader";
import { ComingSoon } from "@/components/shared/coming-soon";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <Suspense fallback={<SchoolLoader />}>
      <School>
        <div className="relative flex h-svh items-center justify-center">
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="mx-auto w-full max-w-xl px-6">
            <ComingSoon />
          </div>
        </div>
      </School>
    </Suspense>
  );
}

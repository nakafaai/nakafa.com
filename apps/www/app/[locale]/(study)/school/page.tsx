import { SpinnerIcon } from "@repo/design-system/components/ui/icons";
import { Particles } from "@repo/design-system/components/ui/particles";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { Suspense, use } from "react";
import { School } from "@/components/school";
import { ComingSoon } from "@/components/shared/coming-soon";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <Suspense
      fallback={
        <div className="relative flex h-svh items-center justify-center">
          <SpinnerIcon
            aria-hidden="true"
            className="size-6 shrink-0 text-primary"
          />
        </div>
      }
    >
      <School>
        <div
          className="relative flex h-svh items-center justify-center"
          data-pagefind-ignore
        >
          <Particles className="pointer-events-none absolute inset-0 opacity-80" />
          <div className="mx-auto w-full max-w-xl px-6">
            <ComingSoon />
          </div>
        </div>
      </School>
    </Suspense>
  );
}

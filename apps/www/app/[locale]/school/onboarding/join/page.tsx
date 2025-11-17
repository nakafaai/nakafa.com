import { Particles } from "@repo/design-system/components/ui/particles";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  return (
    <div
      className="relative flex min-h-svh items-center justify-center"
      data-pagefind-ignore
    >
      <Particles className="-z-1 pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto w-full max-w-xl space-y-8 px-6 py-12" />
    </div>
  );
}

import { Particles } from "@repo/design-system/components/ui/particles";
import type { Locale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

export const revalidate = false;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default async function Page({ params }: Props) {
  const { locale } = await params;

  setRequestLocale(locale);

  return (
    <div
      className="relative flex h-[calc(100svh-4rem)] items-center justify-center lg:h-svh"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
    </div>
  );
}

import { Particles } from "@repo/design-system/components/ui/particles";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { ComingSoon } from "@/components/shared/coming-soon";
import { getLocaleOrThrow } from "@/lib/i18n/params";

export default function Page(props: PageProps<"/[locale]/school/auth">) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  setRequestLocale(locale);

  return (
    <div
      className="relative flex h-svh items-center justify-center"
      data-pagefind-ignore
    >
      <Particles className="pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto w-full max-w-xl px-6">
        <ComingSoon />
      </div>
    </div>
  );
}

import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { ArrowLeftIcon } from "lucide-react";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  const t = useTranslations("School.Onboarding");

  return (
    <div className="m-auto w-full max-w-xl space-y-8 px-6 py-12">
      <header className="space-y-2 px-2">
        <NavigationLink
          className="flex items-center gap-2 text-primary text-sm underline-offset-4 hover:underline"
          href="/school/onboarding"
        >
          <ArrowLeftIcon className="size-4" />
          {t("back")}
        </NavigationLink>
        <h1 className="text-pretty font-medium text-lg">{t("join")}</h1>
      </header>

      <div className="rounded-xl border bg-card p-6 shadow-sm" />
    </div>
  );
}

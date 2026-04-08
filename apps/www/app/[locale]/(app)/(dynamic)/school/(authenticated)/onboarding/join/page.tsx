import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { SchoolOnboardingJoinForm } from "./form";

export default function Page(
  props: PageProps<"/[locale]/school/onboarding/join">
) {
  const { params } = props;
  const { locale: rawLocale } = use(params);
  const locale = getLocaleOrThrow(rawLocale);

  setRequestLocale(locale);

  const t = useTranslations("School.Onboarding");

  return (
    <div className="m-auto w-full max-w-xl space-y-6 px-6 py-12">
      <header className="space-y-2 px-2">
        <NavigationLink
          className="flex items-center gap-2 text-primary text-sm underline-offset-4 hover:underline"
          href="/school/onboarding"
        >
          <HugeIcons className="size-4" icon={ArrowLeft02Icon} />
          {t("back")}
        </NavigationLink>
        <h1 className="text-pretty font-medium text-lg">{t("join")}</h1>
      </header>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <SchoolOnboardingJoinForm />
      </div>
    </div>
  );
}

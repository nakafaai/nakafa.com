import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { Particles } from "@repo/design-system/components/ui/particles";
import Image from "next/image";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import SchoolCreateImage from "@/public/school-create.png";
import SchoolJoinImage from "@/public/school-join.png";

const IMAGE_WIDTH = 238;
const IMAGE_HEIGHT = 134;

type Props = {
  params: Promise<{ locale: Locale }>;
};

export default function Page({ params }: Props) {
  const { locale } = use(params);

  setRequestLocale(locale);

  const t = useTranslations("School.Onboarding");

  return (
    <div
      className="relative flex min-h-svh items-center justify-center"
      data-pagefind-ignore
    >
      <Particles className="-z-1 pointer-events-none absolute inset-0 opacity-80" />
      <div className="mx-auto w-full max-w-xl space-y-8 px-6 py-12">
        <header className="space-y-4 text-center">
          <h1 className="text-pretty font-medium text-2xl tracking-tight sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-pretty text-muted-foreground sm:text-lg">
            {t("description")}
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <NavigationLink
            className="group flex flex-col justify-between rounded-xl border bg-card shadow-xs transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))]"
            href="/school/onboarding/create"
          >
            <div className="p-2">
              <Image
                alt="Nakafa School Create"
                className="w-full rounded-md bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))]"
                height={IMAGE_HEIGHT}
                src={SchoolCreateImage}
                title="Nakafa School Create"
                width={IMAGE_WIDTH}
              />
            </div>
            <div className="space-y-6 px-6 pt-3 pb-6">
              <div className="grid gap-2">
                <h2 className="font-medium text-lg">{t("create")}</h2>
                <p className="text-muted-foreground text-sm">
                  {t("create-description")}
                </p>
              </div>
            </div>
          </NavigationLink>

          <NavigationLink
            className="flex flex-col justify-between rounded-xl border bg-card shadow-xs transition-colors ease-out hover:border-primary/50 hover:bg-[color-mix(in_oklch,var(--primary)_1%,var(--background))]"
            href="/school/onboarding/join"
          >
            <div className="p-2">
              <Image
                alt="Nakafa School Join"
                className="w-full rounded-md bg-[color-mix(in_oklch,var(--primary)_2.5%,var(--background))]"
                height={IMAGE_HEIGHT}
                src={SchoolJoinImage}
                title="Nakafa School Join"
                width={IMAGE_WIDTH}
              />
            </div>
            <div className="space-y-6 px-6 pt-3 pb-6">
              <div className="grid gap-2">
                <h2 className="font-medium text-lg">{t("join")}</h2>
                <p className="text-muted-foreground text-sm">
                  {t("join-description")}
                </p>
              </div>
            </div>
          </NavigationLink>
        </section>
      </div>
    </div>
  );
}

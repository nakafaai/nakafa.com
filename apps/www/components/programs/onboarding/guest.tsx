import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import NavigationLink from "@repo/design-system/components/ui/navigation-link";
import { useTranslations } from "next-intl";

/** Shows the sign-in prompt for visitors who have not signed in yet. */
export function GuestProgramDiscovery() {
  const t = useTranslations("LearningPrograms");

  return (
    <section className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-6 py-12 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="font-semibold text-3xl sm:text-4xl">
          {t("onboarding.auth-title")}
        </h1>
        <p className="text-muted-foreground">{t("onboarding.auth-helper")}</p>
      </div>
      <Button
        nativeButton={false}
        render={
          <NavigationLink href="/auth">
            {t("onboarding.auth-cta")}
            <HugeIcons data-icon="inline-end" icon={ArrowRight02Icon} />
          </NavigationLink>
        }
      />
    </section>
  );
}

import { Building02Icon, Mail01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { useTranslations } from "next-intl";

export function Schools() {
  const t = useTranslations("SchoolsSection");

  return (
    <section className="scroll-mt-28 border-y bg-card" id="schools">
      <div className="mx-auto w-full max-w-7xl border-x">
        <div className="flex flex-col gap-8 px-6 py-24 lg:py-32">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm">
              <HugeIcons className="size-4" icon={Building02Icon} />
              {t("badge")}
            </span>
          </div>

          <h2 className="max-w-3xl text-balance font-medium text-3xl tracking-tight sm:text-4xl">
            {t.rich("headline", {
              mark: (chunks) => <mark>{chunks}</mark>,
            })}
          </h2>

          <p className="max-w-2xl text-pretty text-lg text-muted-foreground">
            {t("description")}
          </p>

          <Button
            className="w-fit"
            nativeButton={false}
            render={
              <a
                href="mailto:nakafaai@gmail.com"
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeIcons icon={Mail01Icon} />
                {t("cta")}
              </a>
            }
          />
        </div>
      </div>
    </section>
  );
}

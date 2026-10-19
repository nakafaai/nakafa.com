import { School01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { Link } from "@repo/internationalization/src/navigation";
import type { Mascot } from "@repo/mascot/code";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { MarketingSection } from "@/components/marketing/shared/section";

/**
 * The school part: a dark band with rounded corners, the words for a whole
 * school, the link that opens one, the founder's address for a school that
 * wants help, and one class of different animals in a row. The page gives the
 * class, a slice of its own cast, so no animal appears twice.
 */
export function Schools({ herd }: { herd: readonly (typeof Mascot.Type)[] }) {
  const t = useTranslations("Landing");

  return (
    <MarketingSection id="school">
      <div className="mx-auto w-full max-w-7xl">
        <div className="grid gap-10 rounded-xl bg-nina-ink px-6 py-16 text-nina-face lg:grid-cols-2 lg:items-center lg:px-16">
          <div className="grid justify-items-start gap-6">
            <div className="grid gap-3">
              <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
                {t("school-title")}
              </h2>
              <p className="max-w-xl text-pretty text-base">
                {t("school-lead")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button
                className="w-fit"
                nativeButton={false}
                render={
                  <Link href="/school/new">
                    <HugeIcons icon={School01Icon} />
                    {t("school-cta")}
                  </Link>
                }
                variant="inverse"
              />
              <a
                className="font-medium text-sm underline-offset-4 hover:underline"
                href={`mailto:${COMPANY_IDENTITY.email}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("school-founder")}
              </a>
            </div>
          </div>
          <ul
            aria-label={t("school-class")}
            className="flex flex-wrap items-end justify-center gap-2"
          >
            {Arr.map(herd, (mascot) => (
              <li key={mascot.animal}>
                <PersonAvatar className="size-16" mascot={mascot} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarketingSection>
  );
}

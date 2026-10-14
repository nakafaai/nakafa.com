import { Mail01Icon } from "@hugeicons/core-free-icons";
import { Animal } from "@repo/design-system/components/ui/animal";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { CLASS_HERD } from "@/components/marketing/about/toys/herd";

/**
 * The school part: a dark band with rounded corners, the words for a whole
 * school, a mail link, and one class of different animals in a row.
 */
export function Schools() {
  const t = useTranslations("Landing");

  return (
    <section className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32" id="school">
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
            <Button
              className="w-fit"
              nativeButton={false}
              render={
                <a
                  href={`mailto:${COMPANY_IDENTITY.email}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HugeIcons icon={Mail01Icon} />
                  {t("school-cta")}
                </a>
              }
              variant="secondary"
            />
          </div>
          <ul
            aria-label={t("school-class")}
            className="flex flex-wrap items-end justify-center gap-2"
          >
            {Arr.map(CLASS_HERD, (mascot) => (
              <li key={mascot.animal}>
                <Animal className="size-16" mascot={mascot} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

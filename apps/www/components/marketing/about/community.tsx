import { DiscordIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { CastAnimal } from "@/components/marketing/about/cast";
import {
  CROWD_HERD,
  CROWD_TYPING_EVERY,
} from "@/components/marketing/about/toys/herd";

/**
 * The community part: a line about learning together, the Discord link, and a
 * crowd of friends, some of them typing.
 */
export function Community() {
  const t = useTranslations("Landing");

  return (
    <section
      className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32"
      id="community"
    >
      <div className="mx-auto grid w-full max-w-7xl gap-12">
        <div className="grid justify-items-start gap-6">
          <h2 className="text-balance text-3xl tracking-tight sm:text-4xl">
            {t("community-title")}
          </h2>
          <p className="max-w-xl text-pretty text-base text-muted-foreground">
            {t("community-lead")}
          </p>
          <Button
            nativeButton={false}
            render={
              <a
                href={COMPANY_SOCIAL_PROFILES.discord}
                rel="noopener noreferrer"
                target="_blank"
              >
                <HugeIcons icon={DiscordIcon} />
                {t("community-cta")}
              </a>
            }
          />
        </div>
        <ul
          aria-label={t("community-crowd")}
          className="grid grid-cols-6 justify-items-center gap-4 min-[760px]:grid-cols-9"
        >
          {Arr.map(CROWD_HERD, (mascot, index) => (
            <li className="relative" key={mascot.animal}>
              <CastAnimal
                className="size-14 min-[760px]:size-16"
                mascot={mascot}
              />
              {index % CROWD_TYPING_EVERY === 0 ? (
                <span className="absolute -end-2 -top-3 rounded-full bg-card px-2 py-1 ring-1 ring-foreground/10">
                  <TypingLoader />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

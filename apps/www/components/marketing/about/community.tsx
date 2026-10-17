import { DiscordIcon } from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { TypingLoader } from "@repo/design-system/components/ui/typing-loader";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import {
  CROWD_HERD,
  CROWD_TYPING_EVERY,
} from "@/components/marketing/about/toys/herd";

/**
 * The community part, in the middle of the page: a line about learning
 * together, the Discord link, and a close crowd of friends, some of them
 * typing: nine to a row where nine fit, six below that. The crowd is one named picture to
 * assistive technology, so its friends and their typing bubbles stay hidden.
 */
export function Community() {
  const t = useTranslations("Landing");

  return (
    <section
      className="scroll-mt-28 px-6 py-20 lg:px-10 lg:py-32"
      id="community"
    >
      <div className="mx-auto grid w-full max-w-7xl justify-items-center gap-12">
        <div className="grid justify-items-center gap-6 text-center">
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
        <div
          aria-label={t("community-crowd")}
          className="grid w-fit grid-cols-6 gap-3 min-[760px]:grid-cols-9"
          role="img"
        >
          {Arr.map(CROWD_HERD, (mascot, index) => (
            <div className="relative" key={mascot.animal}>
              <PersonAvatar
                className="size-14 min-[760px]:size-16"
                mascot={mascot}
              />
              {index % CROWD_TYPING_EVERY === 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -end-2 -top-3 rounded-full bg-card px-2 py-1 ring-1 ring-foreground/10"
                >
                  <TypingLoader />
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

"use client";

import {
  DiscordIcon,
  GithubIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { cn } from "cn";
import { useTranslations } from "next-intl";

interface Props {
  className?: string;
  githubUrl?: string;
}

/** Renders source and community links for learn page catalogs. */
export function RefContent({ githubUrl, className }: Props) {
  const t = useTranslations("Common");

  return (
    <section
      aria-labelledby={t("references")}
      className={cn("space-y-4", className)}
    >
      <h2
        className="scroll-mt-28 font-medium text-2xl leading-tight tracking-tight"
        id={t("references")}
      >
        {t("references")}
      </h2>

      <nav
        aria-label="Reference actions"
        className="flex flex-wrap items-center gap-2"
      >
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("source-code")}
                nativeButton={false}
                render={
                  <a
                    href={githubUrl ?? "https://github.com/nakafaai/nakafa.com"}
                    rel="noopener noreferrer"
                    target="_blank"
                    title={t("source-code")}
                  >
                    <span className="sr-only">{t("source-code")}</span>
                    <HugeIcons className="size-4" icon={GithubIcon} />
                  </a>
                }
                size="icon"
                variant="outline"
              />
            }
          />
          <TooltipContent side="bottom">
            <p>{t("source-code")}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                nativeButton={false}
                render={
                  <a
                    href={COMPANY_SOCIAL_PROFILES.youtube}
                    rel="noopener noreferrer"
                    target="_blank"
                    title={t("videos")}
                  >
                    <span className="sr-only">{t("videos")}</span>
                    <HugeIcons className="size-4" icon={YoutubeIcon} />
                  </a>
                }
                size="icon"
                variant="outline"
              />
            }
          />
          <TooltipContent side="bottom">
            <p>{t("videos")}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                nativeButton={false}
                render={
                  <a
                    href={COMPANY_SOCIAL_PROFILES.discord}
                    rel="noopener noreferrer"
                    target="_blank"
                    title={t("community")}
                  >
                    <span className="sr-only">{t("community")}</span>
                    <HugeIcons className="size-4" icon={DiscordIcon} />
                  </a>
                }
                size="icon"
                variant="outline"
              />
            }
          />
          <TooltipContent side="bottom">
            <p>{t("community")}</p>
          </TooltipContent>
        </Tooltip>
      </nav>
    </section>
  );
}

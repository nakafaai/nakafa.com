"use client";

import {
  ArrowDown01Icon,
  DiscordIcon,
  GithubIcon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import { ButtonGroup } from "@repo/design-system/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { cn } from "cn";
import { useId } from "react";
import { useTranslations } from "use-intl";

interface Props {
  className?: string;
  githubUrl?: string | undefined;
}

/**
 * Renders the references of a learn page catalog: its source code as the one
 * button, joined with a menu of the places the community meets, the videos and
 * the community server. Every link opens in a new tab.
 */
export function RefContent({ githubUrl, className }: Props) {
  const t = useTranslations("Common");
  const heading = useId();

  return (
    <section aria-labelledby={heading} className={cn("space-y-4", className)}>
      <h2
        className="scroll-mt-28 font-medium text-2xl leading-tight tracking-tight"
        id={heading}
      >
        {t("references")}
      </h2>

      <ButtonGroup>
        <Button
          nativeButton={false}
          render={
            <a
              href={githubUrl ?? "https://github.com/nakafaai/nakafa.com"}
              rel="noopener noreferrer"
              target="_blank"
            >
              <HugeIcons icon={GithubIcon} />
              {t("source-code")}
            </a>
          }
          variant="outline"
        />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button size="icon" variant="outline" />}
          >
            <HugeIcons icon={ArrowDown01Icon} />
            <span className="sr-only">{t("more")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              render={
                <a
                  href={COMPANY_SOCIAL_PROFILES.youtube}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HugeIcons icon={YoutubeIcon} />
                  {t("videos")}
                </a>
              }
            />
            <DropdownMenuItem
              render={
                <a
                  href={COMPANY_SOCIAL_PROFILES.discord}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <HugeIcons icon={DiscordIcon} />
                  {t("community")}
                </a>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </section>
  );
}

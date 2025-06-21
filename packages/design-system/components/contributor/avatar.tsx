import type { Contributor } from "@repo/contents/_types/contributor";
import { Character } from "@repo/design-system/components/ui/character";
import { IconBrandLinkedin } from "@tabler/icons-react";
import { IconBrandGithub } from "@tabler/icons-react";
import { IconBrandTwitter } from "@tabler/icons-react";
import { useTranslations } from "next-intl";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "../ui/drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

type Props = {
  contributor: Contributor;
};

export function Avatar({ contributor }: Props) {
  const t = useTranslations("Common");

  return (
    <Drawer>
      <Tooltip>
        <TooltipTrigger asChild>
          <DrawerTrigger className="cursor-pointer">
            <Character
              name={`${contributor.name} - ${contributor.username}`}
              className="size-16 shadow-xs"
            />
          </DrawerTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{contributor.name}</p>
        </TooltipContent>
      </Tooltip>

      <DrawerContent className="mx-auto sm:max-w-xs">
        <DrawerHeader>
          <DrawerTitle className="text-center">{contributor.name}</DrawerTitle>
          {contributor.official && (
            <DrawerDescription className="text-center">
              <Badge>{t("official")}</Badge>
            </DrawerDescription>
          )}
        </DrawerHeader>
        <DrawerFooter>
          {contributor.social && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {contributor.social.twitter && (
                <a
                  href={contributor.social.twitter}
                  title="Twitter"
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                >
                  <IconBrandTwitter className="size-4" />
                  <span className="sr-only">Twitter</span>
                </a>
              )}
              {contributor.social.github && (
                <a
                  href={contributor.social.github}
                  title="GitHub"
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                >
                  <IconBrandGithub className="size-4" />
                  <span className="sr-only">GitHub</span>
                </a>
              )}
              {contributor.social.linkedin && (
                <a
                  href={contributor.social.linkedin}
                  title="LinkedIn"
                  target="_blank"
                  rel="noreferrer"
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                >
                  <IconBrandLinkedin className="size-4" />
                  <span className="sr-only">LinkedIn</span>
                </a>
              )}
            </div>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

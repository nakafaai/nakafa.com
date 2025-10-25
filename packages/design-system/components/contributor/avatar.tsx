import { SiGithub, SiX } from "@icons-pack/react-simple-icons";
import type { Contributor } from "@repo/contents/_types/contributor";
import { Character } from "@repo/design-system/components/ui/character";
import { cn } from "@repo/design-system/lib/utils";
import { IconBrandLinkedin } from "@tabler/icons-react";
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
  size?: "sm" | "md" | "lg";
};

export function Avatar({ contributor, size = "md" }: Props) {
  const t = useTranslations("Common");

  return (
    <Drawer>
      <Tooltip>
        <TooltipTrigger asChild>
          <DrawerTrigger className="cursor-pointer">
            <Character
              className={cn(
                "size-16 shadow-sm",
                size === "sm" && "size-12",
                size === "lg" && "size-16"
              )}
              name={`${contributor.name} - ${contributor.username}`}
            />
          </DrawerTrigger>
        </TooltipTrigger>
        <TooltipContent>
          <p>{contributor.name}</p>
        </TooltipContent>
      </Tooltip>

      <DrawerContent className="mx-auto sm:max-w-xs">
        <DrawerHeader className="items-center">
          <Character
            className="size-16 shadow-sm"
            name={`${contributor.name} - ${contributor.username}`}
          />
          <DrawerTitle className="text-center">{contributor.name}</DrawerTitle>
          <DrawerDescription className="text-center">
            <Badge>{t(contributor.type)}</Badge>
          </DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          {contributor.social && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {contributor.social.twitter && (
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                  href={contributor.social.twitter}
                  rel="noreferrer"
                  target="_blank"
                  title="Twitter"
                >
                  <SiX className="size-4" />
                  <span className="sr-only">Twitter</span>
                </a>
              )}
              {contributor.social.github && (
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                  href={contributor.social.github}
                  rel="noreferrer"
                  target="_blank"
                  title="GitHub"
                >
                  <SiGithub className="size-4" />
                  <span className="sr-only">GitHub</span>
                </a>
              )}
              {contributor.social.linkedin && (
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                  href={contributor.social.linkedin}
                  rel="noreferrer"
                  target="_blank"
                  title="LinkedIn"
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

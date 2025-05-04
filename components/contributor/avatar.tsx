import { Character } from "@/components/ui/character";
import type { Contributor } from "@/types/contributor";
import { IconBrandLinkedin } from "@tabler/icons-react";
import { IconBrandGithub } from "@tabler/icons-react";
import { IconBrandTwitter } from "@tabler/icons-react";
import { buttonVariants } from "../ui/button";
import {
  Drawer,
  DrawerContent,
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
  return (
    <Drawer>
      <Tooltip>
        <TooltipTrigger asChild>
          <DrawerTrigger className="cursor-pointer">
            <Character
              name={contributor.name}
              className="size-16 rounded-full border shadow-xs"
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
        </DrawerHeader>
        <DrawerFooter>
          {contributor.social && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {contributor.social.twitter && (
                <a
                  href={contributor.social.twitter}
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

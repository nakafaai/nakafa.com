import {
  GithubIcon,
  Linkedin02Icon,
  NewTwitterIcon,
} from "@hugeicons/core-free-icons";
import type { Contributor } from "@repo/contents/_types/contributor";
import { Badge } from "@repo/design-system/components/ui/badge";
import { buttonVariants } from "@repo/design-system/components/ui/button";
import { Character } from "@repo/design-system/components/ui/character";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";

interface Props {
  contributor: Contributor;
  size?: "sm" | "md" | "lg";
}

export function Avatar({ contributor, size = "md" }: Props) {
  const t = useTranslations("Common");

  return (
    <Drawer>
      <Tooltip>
        <TooltipTrigger
          render={
            <DrawerTrigger className="cursor-pointer">
              <Character
                className={cn(
                  "size-16 shadow-sm",
                  size === "sm" && "size-14",
                  size === "lg" && "size-18"
                )}
                name={`${contributor.name} - ${contributor.username}`}
              />
            </DrawerTrigger>
          }
        />
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
          {!!contributor.social && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {!!contributor.social.twitter && (
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                  href={contributor.social.twitter}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="Twitter"
                >
                  <HugeIcons className="size-4" icon={NewTwitterIcon} />
                  <span className="sr-only">Twitter</span>
                </a>
              )}
              {!!contributor.social.github && (
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                  href={contributor.social.github}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="GitHub"
                >
                  <HugeIcons className="size-4" icon={GithubIcon} />
                  <span className="sr-only">GitHub</span>
                </a>
              )}
              {!!contributor.social.linkedin && (
                <a
                  className={buttonVariants({
                    variant: "outline",
                    size: "icon",
                  })}
                  href={contributor.social.linkedin}
                  rel="noopener noreferrer"
                  target="_blank"
                  title="LinkedIn"
                >
                  <HugeIcons className="size-4" icon={Linkedin02Icon} />
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

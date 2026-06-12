import {
  GithubIcon,
  Linkedin02Icon,
  NewTwitterIcon,
} from "@hugeicons/core-free-icons";
import type { Contributor } from "@repo/contents/_types/contributor";
import { HugeIcons } from "@repo/design-system/components/icons/huge-icons";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/design-system/components/ui/drawer";
import {
  Tooltip,
  TooltipPopup,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { Character } from "@repo/design-system/components/visual/character";
import { cva, type VariantProps } from "class-variance-authority";
import { useTranslations } from "next-intl";

const avatarVariants = cva("shadow-sm", {
  defaultVariants: {
    size: "md",
  },
  variants: {
    size: {
      lg: "size-18",
      md: "size-16",
      sm: "size-14",
    },
  },
});

type AvatarProps = VariantProps<typeof avatarVariants> & {
  contributor: Contributor;
};

export function Avatar({ contributor, size }: AvatarProps) {
  const t = useTranslations("Common");

  return (
    <Drawer>
      <Tooltip>
        <TooltipTrigger
          render={
            <DrawerTrigger
              aria-label={`${t("open")} ${contributor.name}`}
              title={contributor.name}
            >
              <Character
                className={avatarVariants({ size })}
                name={`${contributor.name} - ${contributor.username}`}
              />
            </DrawerTrigger>
          }
        />
        <TooltipPopup>
          <p>{contributor.name}</p>
        </TooltipPopup>
      </Tooltip>

      <DrawerPopup className="mx-auto sm:max-w-xs" showBar>
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
        <DrawerFooter className="sm:justify-center">
          {!!contributor.social && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {!!contributor.social.twitter && (
                <Button
                  render={
                    <a
                      href={contributor.social.twitter}
                      rel="noopener noreferrer"
                      target="_blank"
                      title="Twitter"
                    >
                      <HugeIcons className="size-4" icon={NewTwitterIcon} />
                      <span className="sr-only">Twitter</span>
                    </a>
                  }
                  size="icon"
                  variant="outline"
                />
              )}
              {!!contributor.social.github && (
                <Button
                  render={
                    <a
                      href={contributor.social.github}
                      rel="noopener noreferrer"
                      target="_blank"
                      title="GitHub"
                    >
                      <HugeIcons className="size-4" icon={GithubIcon} />
                      <span className="sr-only">GitHub</span>
                    </a>
                  }
                  size="icon"
                  variant="outline"
                />
              )}
              {!!contributor.social.linkedin && (
                <Button
                  render={
                    <a
                      href={contributor.social.linkedin}
                      rel="noopener noreferrer"
                      target="_blank"
                      title="LinkedIn"
                    >
                      <HugeIcons className="size-4" icon={Linkedin02Icon} />
                      <span className="sr-only">LinkedIn</span>
                    </a>
                  }
                  size="icon"
                  variant="outline"
                />
              )}
            </div>
          )}
        </DrawerFooter>
      </DrawerPopup>
    </Drawer>
  );
}

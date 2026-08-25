"use client";

import {
  GithubIcon,
  Linkedin02Icon,
  NewTwitterIcon,
} from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import type { Contributor } from "@repo/contents/_types/contributor";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Character } from "@repo/design-system/components/ui/character";
import {
  Drawer,
  DrawerCreateHandle,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@repo/design-system/components/ui/drawer";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { useTranslations } from "next-intl";
import { useState } from "react";

const galleryVariants = cva("flex flex-wrap", {
  defaultVariants: {
    variant: "page",
  },
  variants: {
    variant: {
      marketing: "gap-4",
      page: "gap-2",
    },
  },
});

const avatarVariants = cva("shadow-sm", {
  defaultVariants: {
    variant: "page",
  },
  variants: {
    variant: {
      marketing: "size-18",
      page: "size-16",
    },
  },
});

type ContributorGalleryProps = VariantProps<typeof galleryVariants> & {
  contributors: readonly Contributor[];
};

export function ContributorGallery({
  contributors,
  variant,
}: ContributorGalleryProps) {
  const t = useTranslations("Common");
  const [contributorDrawer] = useState(() => DrawerCreateHandle<Contributor>());
  const isMounted = useMounted();

  return (
    <>
      <div className={galleryVariants({ variant })} data-contributor-gallery="">
        {contributors.map((contributor) => (
          <Tooltip key={contributor.username}>
            <TooltipTrigger
              render={
                <DrawerTrigger
                  aria-label={`${t("open")} ${contributor.name}`}
                  className="cursor-pointer disabled:cursor-default"
                  data-contributor-username={contributor.username}
                  disabled={!isMounted}
                  handle={contributorDrawer}
                  payload={contributor}
                  title={contributor.name}
                >
                  <Character
                    className={avatarVariants({ variant })}
                    name={`${contributor.name} - ${contributor.username}`}
                  />
                </DrawerTrigger>
              }
            />
            <TooltipContent>
              <p>{contributor.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Drawer handle={contributorDrawer}>
        {({ payload }) => {
          if (!payload) {
            return null;
          }

          return <ContributorDrawer contributor={payload} />;
        }}
      </Drawer>
    </>
  );
}

function ContributorDrawer({ contributor }: { contributor: Contributor }) {
  const t = useTranslations("Common");

  return (
    <DrawerPopup
      className="mx-auto sm:max-w-xs"
      data-contributor-drawer=""
      data-contributor-username={contributor.username}
      showBar
    >
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
        {contributor.social && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {contributor.social.twitter && (
              <Button
                nativeButton={false}
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
            {contributor.social.github && (
              <Button
                nativeButton={false}
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
            {contributor.social.linkedin && (
              <Button
                nativeButton={false}
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
  );
}

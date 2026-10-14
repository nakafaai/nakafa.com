"use client";

import {
  GithubIcon,
  Linkedin02Icon,
  NewTwitterIcon,
} from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import type { Contributor } from "@repo/contents/contributor";
import { Animal } from "@repo/design-system/components/ui/animal";
import {
  Avatar,
  AvatarFallback,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
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
import { forSeed } from "@repo/mascot/seed";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr } from "effect";
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

/** The animal of a contributor, drawn from the name and the username that the gallery shows. */
function contributorMascot(contributor: Contributor) {
  return forSeed(`${contributor.name} - ${contributor.username}`);
}

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
        {Arr.map(contributors, (contributor) => (
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
                  <Avatar className={avatarVariants({ variant })}>
                    <AvatarFallback>
                      <Animal mascot={contributorMascot(contributor)} />
                    </AvatarFallback>
                  </Avatar>
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
        <Avatar className="size-16 shadow-sm">
          <AvatarFallback>
            <Animal mascot={contributorMascot(contributor)} />
          </AvatarFallback>
        </Avatar>
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

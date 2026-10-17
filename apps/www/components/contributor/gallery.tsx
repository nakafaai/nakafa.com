"use client";

import {
  GithubIcon,
  Linkedin02Icon,
  NewTwitterIcon,
} from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import type { Contributor } from "@repo/contents/contributor";
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
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { cast, forSeed } from "@repo/mascot/seed";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
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

const avatarVariants = cva("", {
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

/** The seed of the one cast that every contributor gallery draws its animals from. */
const GALLERY_SEED = "contributors";

/**
 * The contributors with their animals, taken in order from one cast, so no two
 * of them share an animal. Past the last animal of the cast no unique animal is
 * left, and a contributor there takes the animal of their own name and username.
 */
function galleryEntries(contributors: readonly Contributor[]) {
  const animals = cast(GALLERY_SEED, contributors.length);
  return Arr.map(contributors, (contributor, place) => ({
    contributor,
    mascot: Option.getOrElse(Arr.get(animals, place), () =>
      forSeed(`${contributor.name} - ${contributor.username}`)
    ),
  }));
}

/** One contributor of the gallery with the animal the gallery and its drawer show. */
type Entry = ReturnType<typeof galleryEntries>[number];

type ContributorGalleryProps = VariantProps<typeof galleryVariants> & {
  contributors: readonly Contributor[];
};

export function ContributorGallery({
  contributors,
  variant,
}: ContributorGalleryProps) {
  const t = useTranslations("Common");
  const [contributorDrawer] = useState(() => DrawerCreateHandle<Entry>());
  const isMounted = useMounted();

  return (
    <>
      <div className={galleryVariants({ variant })} data-contributor-gallery="">
        {Arr.map(galleryEntries(contributors), (entry) => (
          <Tooltip key={entry.contributor.username}>
            <TooltipTrigger
              render={
                <DrawerTrigger
                  aria-label={`${t("open")} ${entry.contributor.name}`}
                  className="cursor-pointer disabled:cursor-default"
                  data-contributor-username={entry.contributor.username}
                  disabled={!isMounted}
                  handle={contributorDrawer}
                  payload={entry}
                  title={entry.contributor.name}
                >
                  <PersonAvatar
                    className={avatarVariants({ variant })}
                    mascot={entry.mascot}
                  />
                </DrawerTrigger>
              }
            />
            <TooltipContent>
              <p>{entry.contributor.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Drawer handle={contributorDrawer}>
        {({ payload }) => {
          if (!payload) {
            return null;
          }

          return (
            <ContributorDrawer
              contributor={payload.contributor}
              mascot={payload.mascot}
            />
          );
        }}
      </Drawer>
    </>
  );
}

function ContributorDrawer({ contributor, mascot }: Entry) {
  const t = useTranslations("Common");

  return (
    <DrawerPopup
      className="mx-auto sm:max-w-xs"
      data-contributor-drawer=""
      data-contributor-username={contributor.username}
      showBar
    >
      <DrawerHeader className="items-center">
        <PersonAvatar className="size-16" mascot={mascot} />
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

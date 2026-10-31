import {
  GithubIcon,
  Linkedin02Icon,
  NewTwitterIcon,
} from "@hugeicons/core-free-icons";
import { useMounted } from "@mantine/hooks";
import type { Contributor } from "@repo/contents/contributor";
import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { PersonAvatar } from "@repo/design-system/components/ui/person";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { buttonVariants } from "@repo/design-system/lib/button";
import { cast, forSeed } from "@repo/mascot/seed";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr, Option } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";

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

/** One contributor of the gallery with the animal the gallery and its dialog show. */
type Entry = ReturnType<typeof galleryEntries>[number];

type ContributorGalleryProps = VariantProps<typeof galleryVariants> & {
  contributors: readonly Contributor[];
};

export function ContributorGallery({
  contributors,
  variant,
}: ContributorGalleryProps) {
  const t = useTranslations("Common");
  // The contributor the one dialog shows, kept while it closes so its card animates out whole.
  const [card, setCard] = useState({
    entry: Option.none<Entry>(),
    open: false,
  });
  const isMounted = useMounted();

  return (
    <>
      <div className={galleryVariants({ variant })} data-contributor-gallery="">
        {Arr.map(galleryEntries(contributors), (entry) => (
          <Tooltip key={entry.contributor.username}>
            <TooltipTrigger
              render={
                <button
                  aria-label={`${t("open")} ${entry.contributor.name}`}
                  className="cursor-pointer disabled:cursor-default"
                  data-contributor-username={entry.contributor.username}
                  disabled={!isMounted}
                  onClick={() =>
                    setCard({ entry: Option.some(entry), open: true })
                  }
                  title={entry.contributor.name}
                  type="button"
                >
                  <PersonAvatar
                    className={avatarVariants({ variant })}
                    mascot={entry.mascot}
                  />
                </button>
              }
            />
            <TooltipContent>
              <p>{entry.contributor.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <ResponsiveDialog
        description={t("contributor-description")}
        footer={Option.match(card.entry, {
          onNone: () => null,
          onSome: ({ contributor }) =>
            contributor.social ? (
              <ContributorLinks social={contributor.social} />
            ) : null,
        })}
        open={card.open}
        setOpen={(open) => setCard((current) => ({ ...current, open }))}
        title={Option.match(card.entry, {
          onNone: () => "",
          onSome: ({ contributor }) => contributor.name,
        })}
      >
        {Option.match(card.entry, {
          onNone: () => null,
          onSome: (entry) => <ContributorCard {...entry} />,
        })}
      </ResponsiveDialog>
    </>
  );
}

/** A contributor's animal and their kind of contribution, in the gallery's dialog. */
function ContributorCard({ contributor, mascot }: Entry) {
  const t = useTranslations("Common");

  return (
    <div className="flex flex-col items-center gap-3">
      <PersonAvatar className="size-16" mascot={mascot} />
      <Badge>{t(contributor.type)}</Badge>
    </div>
  );
}

/** A contributor's profiles elsewhere, each opening in a new tab. */
function ContributorLinks({
  social,
}: {
  social: NonNullable<Contributor["social"]>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {social.twitter && (
        <a
          className={buttonVariants({ size: "icon", variant: "outline" })}
          href={social.twitter}
          rel="noopener noreferrer"
          target="_blank"
          title="Twitter"
        >
          <HugeIcons className="size-4" icon={NewTwitterIcon} />
          <span className="sr-only">Twitter</span>
        </a>
      )}
      {social.github && (
        <a
          className={buttonVariants({ size: "icon", variant: "outline" })}
          href={social.github}
          rel="noopener noreferrer"
          target="_blank"
          title="GitHub"
        >
          <HugeIcons className="size-4" icon={GithubIcon} />
          <span className="sr-only">GitHub</span>
        </a>
      )}
      {social.linkedin && (
        <a
          className={buttonVariants({ size: "icon", variant: "outline" })}
          href={social.linkedin}
          rel="noopener noreferrer"
          target="_blank"
          title="LinkedIn"
        >
          <HugeIcons className="size-4" icon={Linkedin02Icon} />
          <span className="sr-only">LinkedIn</span>
        </a>
      )}
    </div>
  );
}

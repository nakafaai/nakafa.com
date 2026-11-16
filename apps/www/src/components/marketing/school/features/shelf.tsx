import { Badge } from "@repo/design-system/components/ui/badge";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { cva, type VariantProps } from "class-variance-authority";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { stepVariants } from "@/components/marketing/school/features/step";

/** A folder in one of Nina's colours, its tab a shade under its front, so three folders read apart at a glance. */
const folderVariants = cva("absolute rounded-xl", {
  variants: {
    part: {
      front: "inset-x-0 top-[22%] bottom-0 rounded-ss-none",
      tab: "start-0 top-[8%] h-1/4 w-2/5 opacity-80",
    },
    tone: {
      blue: "bg-pop-blue",
      green: "bg-pop-green",
      yellow: "bg-pop-yellow",
    },
  },
});

/**
 * One folder of the library, drawn as a folder: its tab, the sheets that peek out of it, and its front in its colour,
 * with its name and how many things it holds under it. `count` is what it shows, which a story can swap.
 */
export function ShelfFolder({
  count,
  name,
  step,
  tone,
}: {
  count: ReactNode;
  name: string;
  step: 1 | 2 | 3;
  tone: NonNullable<VariantProps<typeof folderVariants>["tone"]>;
}) {
  return (
    <div
      className={stepVariants({
        className:
          "grid min-w-0 gap-2 sm:grid-cols-[4rem_minmax(0,1fr)] sm:items-center sm:gap-3",
        step,
      })}
    >
      <div className="relative aspect-4/3">
        <div className={folderVariants({ part: "tab", tone })} />
        <div className="bg-background ring-foreground/10 absolute inset-x-[12%] top-[14%] h-1/2 -rotate-3 rounded-md ring-1" />
        <div className="bg-background ring-foreground/10 absolute inset-x-[16%] top-[18%] h-1/2 rotate-2 rounded-md ring-1" />
        <div className={folderVariants({ part: "front", tone })} />
      </div>
      <div className="grid min-w-0 gap-0.5">
        <p className="line-clamp-2 text-sm font-medium">{name}</p>
        <p className="text-muted-foreground grid text-xs tabular-nums">
          {count}
        </p>
      </div>
    </div>
  );
}

/** One thing the teacher shared, as a card on the shelf: its picture over its label, rising a little after the row before. */
export function ShelfCard({
  children,
  step,
}: {
  children: ReactNode;
  step: 1 | 2 | 3;
}) {
  return (
    <div
      className={stepVariants({
        className:
          "bg-card ring-foreground/10 grid min-w-0 content-start overflow-hidden rounded-xl shadow-xs ring-1",
        step,
      })}
    >
      {children}
    </div>
  );
}

/** The picture of a shared thing, drawn as itself, above its label. */
export function ShelfPicture({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/50 relative aspect-4/3 overflow-hidden border-b sm:aspect-video">
      {children}
    </div>
  );
}

/**
 * The label of a shared thing: the icon of its kind beside its name, which the caller composes, then its kind and what
 * tells it apart.
 */
export function ShelfLabel({
  children,
  icon,
  kind,
  meta,
}: {
  children: ReactNode;
  icon: Parameters<typeof HugeIcons>[0]["icon"];
  kind: string;
  meta: string;
}) {
  return (
    <div className="grid min-w-0 gap-1 p-3">
      <p className="flex min-w-0 items-center gap-2 text-sm font-medium">
        <HugeIcons className="text-muted-foreground shrink-0" icon={icon} />
        {children}
      </p>
      <p className="text-muted-foreground flex min-w-0 justify-between gap-2 text-xs">
        <span className="truncate">{kind}</span>
        <span className="shrink-0 tabular-nums">{meta}</span>
      </p>
    </div>
  );
}

/** One line of a drawn page, at the length it runs. */
const lineVariants = cva("bg-muted-foreground/25 h-1 rounded-full", {
  variants: {
    length: {
      full: "w-full",
      long: "w-11/12",
      most: "w-4/5",
      short: "w-3/5",
    },
  },
});

/** The lines of a drawn page, so a sheet reads as text without saying anything. */
const LINES = [
  { key: "first", length: "full" },
  { key: "second", length: "long" },
  { key: "third", length: "most" },
  { key: "fourth", length: "full" },
  { key: "fifth", length: "short" },
] as const;

/** A drawn page of a PDF: its title, its lines of text and a figure, with Nina's head on the corner of what she wrote. */
export function ShelfSheet({ nina }: { nina: boolean }) {
  return (
    <div className="bg-background ring-foreground/10 absolute inset-x-[18%] top-[12%] -bottom-2 grid content-start gap-1.5 rounded-t-md p-3 shadow-xs ring-1">
      <div className="bg-foreground/70 mb-1 h-1.5 w-1/2 rounded-full" />
      {Arr.map(LINES, ({ key, length }) => (
        <div className={lineVariants({ length })} key={key} />
      ))}
      <div className="bg-pop-cream mt-1 h-5 w-2/3 rounded-sm" />
      {nina ? (
        <div className="absolute end-1.5 top-1.5">
          <Nina label="" lean="center" size={22} tile="cream" />
        </div>
      ) : null}
    </div>
  );
}

/** A Nakafa lesson, drawn as its first screen: the formula it teaches on Nina's cream. */
export function ShelfLesson() {
  return (
    <div className="bg-pop-cream text-nina-ink absolute inset-0 grid place-items-center">
      <p className="font-serif text-2xl italic">
        p = m<span className="not-italic">·</span>v
      </p>
    </div>
  );
}

/** The options of a drawn question, the third one chosen. */
const OPTIONS = [
  { chosen: false, key: "a" },
  { chosen: false, key: "b" },
  { chosen: true, key: "c" },
  { chosen: false, key: "d" },
] as const;

/** A try-out, drawn as one of its questions: its line and four options, one of them ticked. */
export function ShelfQuestion() {
  return (
    <div className="bg-background absolute inset-0 grid content-center gap-1.5 px-[14%]">
      <div className="bg-foreground/70 mb-1 h-1.5 w-3/4 rounded-full" />
      {Arr.map(OPTIONS, ({ chosen, key }) => (
        <div
          className="ring-foreground/10 data-chosen:bg-success/10 data-chosen:ring-success/40 flex items-center gap-2 rounded-md px-2 py-1 ring-1"
          data-chosen={chosen ? "" : undefined}
          key={key}
        >
          <span
            className="ring-muted-foreground/40 data-chosen:bg-success data-chosen:ring-success size-2 shrink-0 rounded-full ring-1"
            data-chosen={chosen ? "" : undefined}
          />
          <span className="bg-muted-foreground/25 h-1 w-1/2 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * A video, drawn as its still with the play mark, and over it the bar of its upload while it arrives. The bar and the
 * badge are the story's to move: the first HTML shows the video landed, with its badge.
 */
export function ShelfVideo({ fresh }: { fresh: string }) {
  return (
    <div className="bg-pop-blue absolute inset-0 grid place-items-center">
      <svg aria-hidden="true" className="size-10" viewBox="0 0 40 40">
        <circle className="fill-background/90" cx="20" cy="20" r="20" />
        <path className="fill-pop-blue" d="M16 13L28 20L16 27Z" />
      </svg>
      <Badge className="absolute start-2 top-2" data-new="" variant="secondary">
        {fresh}
      </Badge>
      <div
        className="bg-background/90 absolute inset-x-3 bottom-3 h-1.5 overflow-hidden rounded-full opacity-0"
        data-uploading=""
      >
        <div
          className="bg-success h-full origin-left rounded-full"
          data-progress=""
        />
      </div>
    </div>
  );
}

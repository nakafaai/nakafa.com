import { wholeHeight } from "@repo/design-system/components/nina/height";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { ErrorBoundary } from "@repo/design-system/components/ui/error-boundary";
import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { NINA_SIZE } from "@/components/state/size";

/**
 * Where a state stands, which sets its one spacing rule: a framed state, in a panel or in a table, keeps the same
 * room on every side, and a full page's state takes none, because the page around it has its own.
 */
const emptyStateVariants = cva("wrap-anywhere", {
  defaultVariants: { frame: "panel" },
  variants: {
    frame: {
      page: "w-full p-0 md:p-0",
      panel: "flex-1 p-6 md:p-10",
      table: "p-6 md:p-10",
    },
  },
});

/** The scene, the title and the description of a state, as wide as the page on a full page. */
const emptyHeaderVariants = cva("", {
  variants: { frame: { page: "w-full", panel: "", table: "" } },
});

/** The title: a full page's own heading, or a framed state's title at the text's size. */
const emptyTitleVariants = cva("", {
  variants: {
    frame: {
      page: "text-2xl sm:text-3xl",
      panel: "text-base",
      table: "text-base",
    },
  },
});

/** The one sentence, kept to a short measure on a full page. */
const emptyDescriptionVariants = cva("", {
  variants: { frame: { page: "max-w-[34ch] text-base", panel: "", table: "" } },
});

/**
 * The ways on, gone when the way on draws nothing for this viewer, such as sign-in for one who is signed in: on a full
 * page one main action and one quiet one, stacked on a phone, side by side from a tablet.
 */
const emptyActionsVariants = cva("empty:hidden", {
  variants: {
    frame: {
      page: "max-w-xs items-stretch gap-2 *:h-auto *:whitespace-normal sm:w-auto sm:max-w-none sm:flex-row",
      panel: "",
      table: "",
    },
  },
});

/**
 * The one empty or failure state of Nakafa: a list that holds no record yet, a search that found nothing, a read that
 * failed, a page that cannot be found or broke. It stands in the middle of its place with no card around it: the
 * scene, Nina doing what fits the place (`EmptyNina`), then the title, one sentence that adds what the title does
 * not say, and the way on, such as the link that adds the first record or Try again. `frame` says where it stands: a
 * `panel` it fills, a `table` cell under the column heads, or a whole `page`, such as a page that cannot be found or
 * broke, whose title is the page's `h1` and whose scene is her figure, loaded apart (`DeferredFigure`), so a page that
 * renders on the server puts only its words, its links and a reference to her picture into the payload. A word wider
 * than its place breaks, so no state ever scrolls the page sideways.
 */
export function EmptyState({
  action,
  description,
  frame = "panel",
  role,
  scene,
  title,
}: {
  /** The way on, when the place has one. */
  action?: ReactNode;
  description?: ReactNode;
  frame?: NonNullable<VariantProps<typeof emptyStateVariants>["frame"]>;
  /** `alert` for a read that failed, so assistive technology says it at once. */
  role?: "alert";
  /** Nina doing what fits the place, or the figure of a whole page's state: no state is words alone. */
  scene: ReactNode;
  title: ReactNode;
}) {
  return (
    <Empty className={emptyStateVariants({ frame })} role={role}>
      <EmptyHeader className={emptyHeaderVariants({ frame })}>
        <EmptyScene frame={frame}>{scene}</EmptyScene>
        <EmptyTitle className={emptyTitleVariants({ frame })}>
          {title}
        </EmptyTitle>
        {description === undefined ? null : (
          <EmptyDescription className={emptyDescriptionVariants({ frame })}>
            {description}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {action === undefined ? null : (
        <EmptyContent className={emptyActionsVariants({ frame })}>
          {action}
        </EmptyContent>
      )}
    </Empty>
  );
}

/**
 * The place of a state's scene. A whole page's figure, which loads apart, holds its final height before it is drawn,
 * so a late figure moves nothing, clips what is wider than the page leaves it, and leaves its place empty when it
 * cannot be drawn, so the words and the ways on stay on a page that may be the last that works. A framed state's
 * Nina brings her own place.
 */
function EmptyScene({
  children,
  frame,
}: {
  children: ReactNode;
  frame: NonNullable<VariantProps<typeof emptyStateVariants>["frame"]>;
}) {
  if (frame !== "page") {
    return children;
  }
  return (
    <EmptyMedia
      className="w-full overflow-x-clip"
      style={{ height: wholeHeight(NINA_SIZE) }}
    >
      <ErrorBoundary fallback={null}>{children}</ErrorBoundary>
    </EmptyMedia>
  );
}

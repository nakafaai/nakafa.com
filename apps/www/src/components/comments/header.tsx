import { QueryResult, useQuery } from "@confect/react";
import {
  Clock01Icon,
  FavouriteIcon,
  SortingDownIcon,
} from "@hugeicons/core-free-icons";
import comments from "@repo/backend/confect/_generated/refs/comments";
import { CommentSort } from "@repo/backend/confect/comments/queries.spec";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Schema } from "effect";
import { useTranslations } from "use-intl";
import { useCommentDraft } from "@/components/comments/provider";
import { useCommentsSlug } from "@/components/comments/slug";

/**
 * The head of a page's comments: how many there are, replies counted, and the order they list in. The
 * count shows once it is read, and the title keeps its line meanwhile, so nothing under it moves.
 */
export function CommentsHeader() {
  return (
    <header className="flex min-h-9 items-center justify-between gap-3">
      <CommentsTitle />
      <SortMenu />
    </header>
  );
}

/** The title of the comments, which names how many a page holds once it is read. */
function CommentsTitle() {
  const t = useTranslations("Comments");
  const common = useTranslations("Common");
  const slug = useCommentsSlug();
  const count = useQuery(comments.queries.getCommentCount, { slug });

  return (
    <h2
      className="scroll-mt-28 text-lg font-medium tracking-tight"
      id="comments"
    >
      {QueryResult.isSuccess(count)
        ? t("count", { count: count.value })
        : common("comments")}
    </h2>
  );
}

/** The order of the comments, Top or Newest, in a menu of two choices. */
function SortMenu() {
  const t = useTranslations("Comments");
  const common = useTranslations("Common");
  const sort = useCommentDraft((draft) => draft.sort);
  const sortBy = useCommentDraft((draft) => draft.sortBy);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="sm" type="button" variant="ghost">
            <HugeIcons icon={SortingDownIcon} />
            {t(sort === "top" ? "sort-top" : "sort-newest")}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{common("menu-sort")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(value) => {
              if (Schema.is(CommentSort)(value)) {
                sortBy(value);
              }
            }}
            value={sort}
          >
            <DropdownMenuRadioItem value="top">
              <HugeIcons icon={FavouriteIcon} />
              {t("sort-top")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="newest">
              <HugeIcons icon={Clock01Icon} />
              {t("sort-newest")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

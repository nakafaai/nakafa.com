import {
  Delete02Icon,
  Edit02Icon,
  Flag02Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { lazy } from "@repo/design-system/lib/lazy";
import { ClientOnly } from "@tanstack/react-router";
import { HashSet } from "effect";
import { Suspense, useState } from "react";
import { useTranslations } from "use-intl";
import {
  type CommentDialog,
  CommentDialogContext,
} from "@/components/comments/dialog";
import { useCommentDraft } from "@/components/comments/provider";
import { useRowComment } from "@/components/comments/scope";
import { SignedInIsland } from "@/components/providers/island";
import { FeedEnd } from "@/components/user/feed";
import { useViewer } from "@/lib/identity/client";

/** The deletion question, which loads when the menu first opens, before Delete can be chosen. */
const CommentDeletion = lazy(() =>
  import("@/components/comments/delete").then((module) => ({
    default: module.CommentDeletion,
  }))
);

/** The report question, which loads when the menu first opens, before Report can be chosen. */
const CommentReport = lazy(() =>
  import("@/components/comments/report").then((module) => ({
    default: module.CommentReport,
  }))
);

/**
 * The menu of a comment at the end of its row's first line, for a learner: Edit and Delete on their own
 * comment, Report on another learner's. A visitor sees no menu, since every choice needs an account, and a
 * comment the server is still saving holds its menu back.
 */
export function CommentMenu() {
  return (
    <SignedInIsland>
      <LearnerMenu />
    </SignedInIsland>
  );
}

/** The learner's menu of the row's comment, and the question its choice opens. */
function LearnerMenu() {
  const t = useTranslations("Common");
  const comment = useRowComment();
  const viewerId = useViewer((state) => state.account?.appUser._id);
  const saving = useCommentDraft((draft) =>
    HashSet.has(draft.saving, comment._id)
  );
  const edit = useCommentDraft((draft) => draft.edit);
  const [opened, setOpened] = useState(false);
  const [dialog, setDialog] = useState<CommentDialog>(null);
  const own = viewerId === comment.userId;

  return (
    <FeedEnd>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            setOpened(true);
          }
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("more")}
              inert={saving}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("menu-actions")}</DropdownMenuLabel>
            {own ? (
              <>
                <DropdownMenuItem onClick={() => edit(comment._id)}>
                  <HugeIcons icon={Edit02Icon} />
                  {t("edit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDialog("delete")}
                  variant="destructive"
                >
                  <HugeIcons icon={Delete02Icon} />
                  {t("delete")}
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem onClick={() => setDialog("report")}>
                <HugeIcons icon={Flag02Icon} />
                {t("report")}
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {opened ? (
        <CommentDialogContext value={{ dialog, setDialog }}>
          <Suspense fallback={null}>
            <ClientOnly fallback={null}>
              {own ? <CommentDeletion /> : <CommentReport />}
            </ClientOnly>
          </Suspense>
        </CommentDialogContext>
      ) : null}
    </FeedEnd>
  );
}

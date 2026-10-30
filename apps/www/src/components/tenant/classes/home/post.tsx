import { useMutation } from "@confect/react";
import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { PostText } from "@repo/backend/confect/classroom/posts/post";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Clock, DateTime, Effect, Schema, String as Str } from "effect";
import { useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  type ClassPost,
  editPostUpdate,
  removePostUpdate,
} from "@/components/tenant/classes/home/optimistic";
import { useClassScope } from "@/components/tenant/classes/scope";

/**
 * One announcement of the class home: who posted it and when, and its text, which may break
 * anywhere. The teacher's own announcement has a menu that edits it in place or removes it, and
 * says when it also went by email.
 */
export function PostRow({ post }: { post: ClassPost }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const [editing, setEditing] = useState(false);
  const written = format.dateTime(
    DateTime.toDateUtc(DateTime.makeUnsafe(post.createdAt)),
    { dateStyle: "medium", timeStyle: "short" }
  );

  return (
    <Item data-slot="post" render={<li />} variant="outline">
      <ItemHeader>
        <ItemContent className="min-w-0">
          <ItemTitle className="wrap-anywhere line-clamp-none" dir="auto">
            {post.author.name}
          </ItemTitle>
          <ItemDescription>
            {post.editedAt === null
              ? written
              : t("post-edited", { time: written })}
          </ItemDescription>
        </ItemContent>
        {post.mine && !editing ? (
          <PostActions onEdit={() => setEditing(true)} post={post} />
        ) : null}
      </ItemHeader>
      {editing ? (
        <PostEditor onDone={() => setEditing(false)} post={post} />
      ) : (
        <p
          className="wrap-anywhere basis-full whitespace-pre-wrap text-sm"
          dir="auto"
        >
          {post.text}
        </p>
      )}
      {post.mine && post.email ? (
        <p className="basis-full text-muted-foreground text-xs">
          {t("post-emailed")}
        </p>
      ) : null}
    </Item>
  );
}

/** The menu of the teacher's own announcement: Edit, and Remove after a confirmation. */
function PostActions({
  onEdit,
  post,
}: {
  onEdit: () => void;
  post: ClassPost;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const remove = useMutation(classroom.posts.remove);
  const [removing, setRemoving] = useState(false);

  const confirm = () => {
    setRemoving(false);
    runForumCall(
      forumCall(() =>
        remove.withOptimisticUpdate(removePostUpdate)({
          classId,
          postId: post.id,
          slug,
        })
      ),
      toastForumFailure
    );
  };

  return (
    <ItemActions>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={common("more-actions")}
              size="icon-sm"
              variant="ghost"
            >
              <HugeIcons icon={MoreHorizontalIcon} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={onEdit}>
            <HugeIcons icon={PencilEdit02Icon} />
            {t("message-edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRemoving(true)}>
            <HugeIcons icon={Delete02Icon} />
            {t("post-remove")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ResponsiveDialog
        description={t("post-remove-description")}
        footer={
          <>
            <Button onClick={() => setRemoving(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button onClick={confirm} variant="destructive">
              {t("post-remove")}
            </Button>
          </>
        }
        open={removing}
        setOpen={setRemoving}
        title={t("post-remove-title")}
      />
    </ItemActions>
  );
}

/**
 * The field that edits the teacher's own announcement in its place. Save shows the new text at
 * once, and a refusal brings the old text back with the toast every School action uses. Escape
 * and an unchanged text keep the announcement as it was.
 */
function PostEditor({ onDone, post }: { onDone: () => void; post: ClassPost }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const edit = useMutation(classroom.posts.edit);

  const save = (draft: FormDataEntryValue | null) => {
    onDone();
    const text = Str.trim(typeof draft === "string" ? draft : "");
    if (!Schema.is(PostText)(text) || text === post.text) {
      return;
    }
    runForumCall(
      Effect.flatMap(Clock.currentTimeMillis, (at) =>
        forumCall(() =>
          edit.withOptimisticUpdate(editPostUpdate(at))({
            classId,
            postId: post.id,
            slug,
            text,
          })
        )
      ),
      toastForumFailure
    );
  };

  return (
    <form
      action={(form) => save(form.get("text"))}
      className="flex basis-full flex-col gap-2"
    >
      <Textarea
        aria-label={t("message-edit")}
        autoFocus
        className="min-h-24"
        defaultValue={post.text}
        dir="auto"
        name="text"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onDone();
          }
        }}
        placeholder={t("announcement-placeholder")}
      />
      <div className="flex justify-end gap-2">
        <Button onClick={onDone} size="sm" type="button" variant="outline">
          {common("cancel")}
        </Button>
        <Button size="sm" type="submit">
          {t("message-save")}
        </Button>
      </div>
    </form>
  );
}

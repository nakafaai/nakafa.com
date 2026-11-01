import { useMutation } from "@confect/react";
import {
  Cancel01Icon,
  Clock01Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { PostText } from "@repo/backend/confect/classroom/posts/post";
import { Button } from "@repo/design-system/components/ui/button";
import { DateTimePicker } from "@repo/design-system/components/ui/date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@repo/design-system/components/ui/item";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { Array as Arr, DateTime, Option, Schema, String as Str } from "effect";
import { useId, useState } from "react";
import { useFormatter, useTranslations } from "use-intl";
import { useDialogs } from "@/components/shared/dialogs";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import {
  cancelWaitingUpdate,
  editWaitingUpdate,
  isSavedWaiting,
  type WaitingPost,
} from "@/components/tenant/classes/home/waiting";
import { useClassScope } from "@/components/tenant/classes/scope";
import {
  deadlineOf,
  localDeadline,
} from "@/components/tenant/classes/tasks/deadline";

/**
 * The announcements the viewer keeps for later, above the class's posts, the soonest first. Nobody else in the class
 * reads them until their time, and a viewer who posts in no class sees none of this.
 */
export function WaitingPosts({ posts }: { posts: readonly WaitingPost[] }) {
  const t = useTranslations("Classroom");

  if (Arr.isReadonlyArrayEmpty(posts)) {
    return null;
  }

  return (
    <ItemGroup aria-label={t("post-scheduled")} className="mb-3">
      {Arr.map(posts, (post) => (
        <WaitingRow key={post.clientKey} post={post} />
      ))}
    </ItemGroup>
  );
}

/** One waiting announcement: when it goes out and its text, with a menu once the server keeps it. */
function WaitingRow({ post }: { post: WaitingPost }) {
  const t = useTranslations("Classroom");
  const format = useFormatter();
  const when = format.dateTime(
    DateTime.toDateUtc(DateTime.makeUnsafe(post.publishAt)),
    { dateStyle: "medium", timeStyle: "short" }
  );

  return (
    <Item data-slot="post" render={<li />} variant="outline">
      <ItemHeader>
        <ItemContent className="min-w-0">
          <ItemTitle>{t("post-scheduled")}</ItemTitle>
          <ItemDescription className="flex items-center gap-1.5">
            <HugeIcons aria-hidden="true" icon={Clock01Icon} />
            {when}
          </ItemDescription>
        </ItemContent>
        {isSavedWaiting(post) ? <WaitingMenu post={post} /> : null}
      </ItemHeader>
      <p
        className="basis-full text-sm wrap-anywhere whitespace-pre-wrap"
        dir="auto"
      >
        {post.text}
      </p>
    </Item>
  );
}

/** The menu of a waiting announcement: Edit, which opens its dialog, and Cancel, which takes it away at once. */
function WaitingMenu({ post }: { post: WaitingPost }) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const cancel = useMutation(classroom.scheduled.cancel);
  // Each opening of the dialog mounts it again, so it starts from the announcement as it is then.
  const dialogs = useDialogs<"edit">();

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
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => dialogs.show("edit")}>
            <HugeIcons icon={PencilEdit02Icon} />
            {t("message-edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              runForumCall(
                forumCall(() =>
                  cancel.withOptimisticUpdate(cancelWaitingUpdate)({
                    classId,
                    scheduledId: post.id,
                    slug,
                  })
                ),
                toastForumFailure
              )
            }
            variant="destructive"
          >
            <HugeIcons icon={Cancel01Icon} />
            {t("post-schedule-cancel")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs.kind === "edit" ? (
        <WaitingDialog
          key={dialogs.key}
          open={dialogs.isOpen("edit")}
          post={post}
          setOpen={dialogs.setOpen}
        />
      ) : null}
    </ItemActions>
  );
}

/** The dialog that rewrites a waiting announcement and moves its time. The row shows the change at once. */
function WaitingDialog({
  open,
  post,
  setOpen,
}: {
  open: boolean;
  post: WaitingPost;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const { classId, slug } = useClassScope();
  const id = useId();
  const edit = useMutation(classroom.scheduled.edit);
  const [writtenText, setText] = useState<string | null>(null);
  const [writtenWhen, setWhen] = useState<string | null>(null);
  const text = writtenText ?? post.text;
  const when = writtenWhen ?? localDeadline(post.publishAt);
  const body = Str.trim(text);
  const publishAt = deadlineOf(when);
  const ready =
    Schema.is(PostText)(body) &&
    Option.isSome(publishAt) &&
    (body !== post.text || publishAt.value !== post.publishAt);

  const save = () => {
    if (!ready) {
      return;
    }
    setOpen(false);
    runForumCall(
      forumCall(() =>
        edit.withOptimisticUpdate(editWaitingUpdate)({
          classId,
          publishAt: publishAt.value,
          scheduledId: post.id,
          slug,
          text: body,
        })
      ),
      () => {
        setOpen(true);
        toastForumFailure();
      }
    );
  };

  return (
    <ResponsiveDialog
      description={t("post-schedule-description")}
      footer={
        <>
          <Button onClick={() => setOpen(false)} variant="outline">
            {common("cancel")}
          </Button>
          <Button disabled={!ready} onClick={save}>
            {t("message-save")}
          </Button>
        </>
      }
      open={open}
      setOpen={setOpen}
      title={t("post-waiting-edit")}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={`${id}-text`}>{t("post-text")}</FieldLabel>
          <Textarea
            className="min-h-32"
            dir="auto"
            id={`${id}-text`}
            onChange={(event) => setText(event.target.value)}
            placeholder={t("announcement-placeholder")}
            value={text}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-when`}>
            {t("post-schedule-when")}
          </FieldLabel>
          <DateTimePicker
            dayPlaceholder={t("task-day-placeholder")}
            id={`${id}-when`}
            onValueChange={setWhen}
            timePlaceholder={t("task-time-placeholder")}
            value={when}
          />
        </Field>
      </FieldGroup>
    </ResponsiveDialog>
  );
}

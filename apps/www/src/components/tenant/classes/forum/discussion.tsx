import { useTranslations } from "use-intl";
import { isPending } from "@/components/tenant/classes/forum/marks";
import type { ForumMessage } from "@/components/tenant/classes/forum/optimistic";
import { useClassScope } from "@/components/tenant/classes/scope";
import { TargetLink } from "@/lib/routing/link";
import { schoolClassDiscussionTarget } from "@/lib/routing/school/target";

/** The summary of the discussion a message opens, as its channel shows it. */
type Discussion = NonNullable<ForumMessage["discussion"]>;

/**
 * The title of a discussion above the message that opens it, as one line that may break anywhere:
 * its number and title, which open the discussion. While the server saves a new discussion it has no
 * number yet, so the title shows alone and opens nothing.
 */
export function DiscussionTitle({
  discussion,
  message,
}: {
  discussion: Discussion;
  message: ForumMessage;
}) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();

  if (isPending(message)) {
    return (
      <p className="wrap-anywhere font-semibold" dir="auto">
        {discussion.title}
      </p>
    );
  }
  return (
    <TargetLink
      className="wrap-anywhere font-semibold underline-offset-4 hover:underline"
      dir="auto"
      target={schoolClassDiscussionTarget(slug, classSlug, discussion.number)}
    >
      {t("discussion-label", {
        number: discussion.number,
        title: discussion.title,
      })}
    </TargetLink>
  );
}

/**
 * The replies of a discussion under the message that opens it: how many there are, or a way to give
 * the first, and one dot while a reply came after the viewer last read the discussion. It opens the
 * discussion, once the server holds it.
 */
export function DiscussionReplies({
  discussion,
  message,
}: {
  discussion: Discussion;
  message: ForumMessage;
}) {
  const t = useTranslations("Classroom");
  const { classSlug, slug } = useClassScope();

  if (isPending(message)) {
    return null;
  }
  return (
    <TargetLink
      className="flex w-fit items-center gap-2 px-3 font-medium text-primary text-sm underline-offset-4 hover:underline"
      target={schoolClassDiscussionTarget(slug, classSlug, discussion.number)}
    >
      {discussion.replies === 0
        ? t("discussion-reply")
        : t("discussion-replies", { count: discussion.replies })}
      {discussion.unread ? (
        <>
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-primary"
            data-slot="unread-dot"
          />
          <span className="sr-only">{t("unread")}</span>
        </>
      ) : null}
    </TargetLink>
  );
}

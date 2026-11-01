import { QueryResult, useMutation, useQuery } from "@confect/react";
import { ChartBarLineIcon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  forumCall,
  runForumCall,
  toastForumFailure,
} from "@/components/tenant/classes/forum/call";
import { NewPoll, PollCard } from "@/components/tenant/classes/forum/poll";
import {
  type ClassPost,
  votePostUpdate,
} from "@/components/tenant/classes/home/optimistic";
import { publishPost } from "@/components/tenant/classes/home/publish";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";

/**
 * Asks the class a poll on its home. The dialog closes on send and the poll shows at once first among the posts, and
 * a refusal says so with the toast every School action uses. On a narrow screen the button keeps its icon.
 */
export function NewPostPoll() {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const publish = useMutation(classroom.posts.publish);
  const viewer = useViewerQuery();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        className="@xs/header:has-[>svg]:px-4"
        disabled={viewer._tag !== "Success"}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <HugeIcons
          aria-hidden="true"
          className="@xs/header:hidden"
          icon={ChartBarLineIcon}
        />
        <span className="@max-xs/header:sr-only">{t("post-new-poll")}</span>
      </Button>
      <NewPoll
        onSend={(poll) => {
          if (viewer._tag !== "Success") {
            return;
          }
          const { person } = viewer.value;
          runForumCall(
            Effect.flatMap(randomUuid, (clientKey) =>
              publishPost(
                (update, args) => publish.withOptimisticUpdate(update)(args),
                { id: person.id, name: person.name },
                {
                  classId,
                  clientKey,
                  email: false,
                  poll,
                  slug,
                  text: poll.question,
                }
              )
            ),
            toastForumFailure
          );
        }}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
}

/** The poll of an announcement with its votes, which whoever writes in the class takes once the server keeps it. */
export function PostPoll({
  poll,
  post,
}: {
  poll: NonNullable<ClassPost["poll"]>;
  post: ClassPost;
}) {
  const { can, classId, slug } = useClassScope();
  const saved = post.id !== post.clientKey;
  const read = useQuery(
    classroom.posts.votes,
    saved ? { classId, postIds: [post.id], slug } : "skip"
  );
  const vote = useMutation(classroom.posts.vote);

  return (
    <PollCard
      disabled={!(saved && Arr.contains(can, "forum.post"))}
      onChoose={(options) =>
        runForumCall(
          forumCall(() =>
            vote.withOptimisticUpdate(votePostUpdate)({
              classId,
              options,
              postId: post.id,
              slug,
            })
          ),
          toastForumFailure
        )
      }
      poll={poll}
      votes={
        QueryResult.isSuccess(read)
          ? Arr.flatMap(read.value, (found) => found.votes)
          : []
      }
    />
  );
}

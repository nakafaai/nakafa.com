import { QueryResult, useMutation, useQuery } from "@confect/react";
import { ChartBarLineIcon } from "@hugeicons/core-free-icons";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { randomUuid } from "@repo/utilities/uuid";
import { Array as Arr, Effect } from "effect";
import { useState } from "react";
import { useTranslations } from "use-intl";
import { HeaderLabel } from "@/components/shared/breadcrumb/frame";
import { NewPoll, PollCard } from "@/components/tenant/classes/forum/poll";
import {
  type ClassPost,
  votePostUpdate,
} from "@/components/tenant/classes/home/optimistic";
import { publishPost } from "@/components/tenant/classes/home/publish";
import { useClassScope } from "@/components/tenant/classes/scope";
import { useViewerQuery } from "@/components/tenant/context";
import { runSchoolWrite, schoolCall } from "@/components/tenant/write";

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
      {/* A narrow header shows the icon alone, so its name stays in the tooltip. */}
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              className="@xs/header:has-[>svg]:px-4"
              disabled={viewer._tag !== "Success"}
              onClick={() => setOpen(true)}
              type="button"
              variant="outline"
            />
          }
        >
          <HugeIcons
            aria-hidden="true"
            className="@2xl/header:hidden"
            icon={ChartBarLineIcon}
          />
          <HeaderLabel>{t("poll-title")}</HeaderLabel>
        </TooltipTrigger>
        <TooltipContent side="bottom">{t("poll-title")}</TooltipContent>
      </Tooltip>
      <NewPoll
        onSend={(poll) => {
          if (viewer._tag !== "Success") {
            return;
          }
          const { person } = viewer.value;
          runSchoolWrite(
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
            )
          );
        }}
        open={open}
        setOpen={setOpen}
      />
    </>
  );
}

/** An announcement's poll with its votes, which whoever writes in the class takes once the server keeps it. */
export function PostPoll({ post }: { post: ClassPost }) {
  const { can, classId, slug } = useClassScope();
  const saved = post.id !== post.clientKey;
  const read = useQuery(
    classroom.posts.votes,
    saved && post.poll !== null ? { classId, postIds: [post.id], slug } : "skip"
  );
  const vote = useMutation(classroom.posts.vote);

  if (post.poll === null) {
    return null;
  }
  return (
    <PollCard
      disabled={!(saved && Arr.contains(can, "forum.post"))}
      onChoose={(options) =>
        runSchoolWrite(
          schoolCall(() =>
            vote.withOptimisticUpdate(votePostUpdate)({
              classId,
              options,
              postId: post.id,
              slug,
            })
          )
        )
      }
      poll={post.poll}
      votes={
        QueryResult.isSuccess(read)
          ? Arr.flatMap(read.value, (found) => found.votes)
          : []
      }
    />
  );
}

import { useMutation } from "@confect/react";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  ChannelName,
  type ChannelView,
} from "@repo/backend/confect/classroom/forum/channel";
import { DiscussionTitle } from "@repo/backend/confect/classroom/forum/thread";
import { Schema } from "effect";
import { startTransition } from "react";
import { useTranslations } from "use-intl";
import {
  renameChannelUpdate,
  renameDiscussionUpdate,
} from "@/components/tenant/classes/forum/optimistic";
import { useClassScope } from "@/components/tenant/classes/scope";
import { LineDialog } from "@/components/tenant/line";
import { saveSchool } from "@/components/tenant/settings/save";

const SOURCE = "components/tenant/classes/forum/rename";

/** The dialog that renames a topic channel, from its row. The list shows the name at once, and a refused name goes back. */
export function ChannelRenameDialog({
  channel,
  open,
  setOpen,
}: {
  channel: typeof ChannelView.Type;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const rename = useMutation(
    classroom.forum.channels.rename
  ).withOptimisticUpdate(renameChannelUpdate);

  return (
    <LineDialog
      description={t("channel-rename-description")}
      initial={channel.name}
      isValid={Schema.is(ChannelName)}
      label={t("channel-name")}
      onSave={(name) =>
        startTransition(() =>
          saveSchool(
            () => rename({ channelId: channel.id, classId, name, slug }),
            SOURCE
          )
        )
      }
      open={open}
      placeholder={t("channel-name-placeholder")}
      setOpen={setOpen}
      title={t("channel-rename")}
    />
  );
}

/** The dialog that renames a discussion, from its opening message. Every view shows the title at once. */
export function DiscussionRenameDialog({
  number,
  open,
  setOpen,
  title,
}: {
  number: number;
  open: boolean;
  setOpen: (open: boolean) => void;
  title: string;
}) {
  const t = useTranslations("Classroom");
  const { classId, slug } = useClassScope();
  const rename = useMutation(
    classroom.forum.threads.rename
  ).withOptimisticUpdate(renameDiscussionUpdate);

  return (
    <LineDialog
      description={t("discussion-rename-description")}
      initial={title}
      isValid={Schema.is(DiscussionTitle)}
      label={t("discussion-title")}
      onSave={(next) =>
        startTransition(() =>
          saveSchool(
            () => rename({ classId, number, slug, title: next }),
            SOURCE
          )
        )
      }
      open={open}
      placeholder={t("discussion-title-placeholder")}
      setOpen={setOpen}
      title={t("discussion-rename")}
    />
  );
}

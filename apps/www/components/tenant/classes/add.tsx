"use client";

import { useMutation } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import { ChannelName } from "@repo/backend/confect/classroom/forum/channel";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, Schema, String as Str } from "effect";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import type { StoreApi } from "zustand";
import type { ChannelDrafts } from "@/components/tenant/classes/drafts";
import { reportClientException } from "@/lib/analytics/client";

/** A call that did not complete at all: the network failed, or the call was rejected before the server answered. */
class ChannelCallFailed extends Data.TaggedError("ChannelCallFailed")<{
  readonly cause: unknown;
}> {}

/**
 * Adds a topic channel to the class. The name joins the list as a saving row at once. When the
 * server answers, the row gives way to the saved channel; when it refuses the name or the call
 * does not complete, the row goes and the action-error toast shows. The dialog closes on submit,
 * so the list is the place the channel appears.
 */
export function AddChannel({
  classId,
  drafts,
  slug,
}: {
  classId: Id<"classes">;
  drafts: StoreApi<ChannelDrafts>;
  slug: TenantSlug;
}) {
  const t = useTranslations("Classroom");
  const common = useTranslations("Common");
  const add = useMutation(classroom.forum.channels.add);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const id = useId();
  const name = Str.trim(title);
  const ready = Schema.is(ChannelName)(name);

  /** Shows the channel as saving, sends it, and removes the row once the server settles the call. */
  const submit = () => {
    if (!ready) {
      return;
    }
    setOpen(false);
    setTitle("");
    drafts.getState().start(name);
    Effect.runPromise(
      Effect.tryPromise({
        catch: (cause) => new ChannelCallFailed({ cause }),
        try: () => add({ classId, name, slug }),
      }).pipe(
        Effect.flatMap(Effect.fromResult),
        Effect.matchEffect({
          onFailure: (error) =>
            reportClientException(error, {
              source: "components/tenant/classes/add",
            }).pipe(
              Effect.andThen(
                Effect.sync(() =>
                  toast.error({
                    description: "action-error.description",
                    title: "action-error.title",
                  })
                )
              )
            ),
          onSuccess: () => Effect.void,
        }),
        Effect.ensuring(Effect.sync(() => drafts.getState().end(name)))
      )
    );
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>{t("add-channel")}</Button>
      <ResponsiveDialog
        description={t("add-channel-description")}
        footer={
          <>
            <Button onClick={() => setOpen(false)} variant="outline">
              {common("cancel")}
            </Button>
            <Button disabled={!ready} onClick={submit}>
              {t("add-submit")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("add-channel-title")}
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>{t("channel-name")}</FieldLabel>
            <Input
              id={`${id}-name`}
              onChange={(event) => setTitle(event.target.value)}
              value={title}
            />
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}

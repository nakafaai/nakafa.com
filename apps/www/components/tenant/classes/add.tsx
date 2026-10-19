"use client";

import { useMutation } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import classroom from "@repo/backend/confect/_generated/refs/classroom";
import {
  CHANNEL_NAME_MAX_LENGTH,
  ChannelName,
} from "@repo/backend/confect/classroom/forum/channel";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/design-system/components/ui/field";
import { Input } from "@repo/design-system/components/ui/input";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Data, Effect, Option, Schema, String as Str } from "effect";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import type { StoreApi } from "zustand";
import type { ChannelDrafts } from "@/components/tenant/classes/drafts";
import { reportClientException } from "@/lib/analytics/client";

/** A call that did not complete at all: the network failed, or the call was rejected before the server answered. */
class ChannelCallFailed extends Data.TaggedError("ChannelCallFailed")<{
  readonly cause: unknown;
}> {}

/**
 * Adds a topic channel to the class. The name joins the list as a saving row at once, and the
 * dialog closes on submit, so the list is the place the channel appears. When the server saves
 * the channel, the typed name clears. When the server refuses the name, or the class holds the
 * most channels it can, the dialog reopens with the reason and the typed name, so the teacher
 * corrects it in place. Any other call that does not complete shows the action-error toast.
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
  const [refusal, setRefusal] = useState<Option.Option<string>>(Option.none);
  const [isPending, startTransition] = useTransition();
  const id = useId();
  const errorId = `${id}-error`;
  const name = Str.trim(title);
  // A name the schema refuses is either empty or too long: the input is one line, and it is trimmed.
  const nameTooLong = name !== "" && !Schema.is(ChannelName)(name);
  const ready = Schema.is(ChannelName)(name) && !isPending;

  /** Reopens the dialog with the reason the server refused the channel. */
  const reopenWith = (message: string) => {
    setRefusal(Option.some(message));
    setOpen(true);
  };
  const refuseName = () =>
    Effect.sync(() => reopenWith(t("channel-name-taken")));
  const refuseLimit = () =>
    Effect.sync(() => reopenWith(t("channel-limit-reached")));

  /**
   * Shows the channel as saving, sends it, and removes the row once the server settles the call. The
   * dialog closes on submit, and the add button stays inert until the call settles, so a second press
   * cannot send the same name twice.
   */
  const submit = () => {
    if (!ready) {
      return;
    }
    setOpen(false);
    setRefusal(Option.none());
    drafts.getState().start(name);
    startTransition(async () => {
      await Effect.runPromise(
        Effect.tryPromise({
          catch: (cause) => new ChannelCallFailed({ cause }),
          try: () => add({ classId, name, slug }),
        }).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.andThen(
            Effect.sync(() =>
              setTitle((current) => (Str.trim(current) === name ? "" : current))
            )
          ),
          Effect.catchTags({
            ChannelLimit: refuseLimit,
            ChannelNameTaken: refuseName,
          }),
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
    });
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
            <Button disabled={!ready} inert={isPending} onClick={submit}>
              {t("add-submit")}
            </Button>
          </>
        }
        open={open}
        setOpen={setOpen}
        title={t("add-channel-title")}
      >
        <FieldGroup>
          <Field data-invalid={Option.isSome(refusal)}>
            <FieldLabel htmlFor={`${id}-name`}>{t("channel-name")}</FieldLabel>
            <Input
              aria-describedby={Option.isSome(refusal) ? errorId : undefined}
              aria-invalid={Option.isSome(refusal)}
              id={`${id}-name`}
              onChange={(event) => {
                setTitle(event.target.value);
                setRefusal(Option.none());
              }}
              value={title}
            />
            {Option.isSome(refusal) ? (
              <FieldError id={errorId}>{refusal.value}</FieldError>
            ) : null}
            {name === "" ? (
              <FieldDescription>{t("channel-name-needed")}</FieldDescription>
            ) : null}
            {nameTooLong ? (
              <FieldDescription>
                {t("channel-name-too-long", {
                  count: CHANNEL_NAME_MAX_LENGTH,
                })}
              </FieldDescription>
            ) : null}
          </Field>
        </FieldGroup>
      </ResponsiveDialog>
    </>
  );
}

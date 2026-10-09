"use client";

import type { Ref } from "@confect/core";
import { QueryResult, useQuery } from "@confect/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { Button } from "@repo/design-system/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { ResponsiveDialog } from "@repo/design-system/components/ui/responsive-dialog";
import { Effect, type Result } from "effect";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useConvexAuth } from "@/components/providers/convex";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import {
  useDisableMemoryMutation,
  useEnableMemoryMutation,
  useForgetMemoryMutation,
} from "@/components/user/mutation.client";
import { reportClientException } from "@/lib/analytics/client";

type Memory = Ref.Returns<typeof nina.memory.get>;

/**
 * Renders Nina memory from the value the settings route already resolved:
 * the switch to turn it on or off and the remembered facts to forget.
 */
export function UserSettingsMemory({
  initialMemory,
}: {
  initialMemory: Memory;
}) {
  const t = useTranslations("Auth");
  const actionErrorMessage = useTranslations("Common")("action-error");
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const query = useQuery(nina.memory.get, isAuthenticated ? {} : "skip");
  if (QueryResult.isFailure(query)) {
    throw query.error;
  }
  const memory = QueryResult.isSuccess(query) ? query.value : initialMemory;
  const enableMemory = useEnableMemoryMutation();
  const disableMemory = useDisableMemoryMutation();
  const forgetMemory = useForgetMemoryMutation();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  /** Runs one memory change and reports a failure without losing the page. */
  function change<A, E>(run: () => Promise<Result.Result<A, E>>) {
    startTransition(async () =>
      Effect.runPromise(
        Effect.tryPromise(run).pipe(
          Effect.flatMap(Effect.fromResult),
          Effect.matchEffect({
            onSuccess: () => Effect.void,
            onFailure: (error) =>
              reportClientException(error, {
                source: "components/user/settings/memory",
              }).pipe(
                Effect.andThen(
                  Effect.sync(() => {
                    toast.error(actionErrorMessage);
                  })
                )
              ),
          })
        )
      )
    );
  }

  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{t("memory")}</CardTitle>
        <CardDescription>{t("memory-description")}</CardDescription>
      </CardHeader>
      {memory ? (
        <CardContent className="border-t px-0">
          {memory.facts.length > 0 ? (
            <ul className="divide-y">
              {memory.facts.map((fact) => (
                <li
                  className="flex items-center gap-2 px-6 py-3"
                  key={fact.key}
                >
                  <p className="flex-1 text-sm">{fact.text}</p>
                  <Button
                    onClick={() =>
                      change(() => forgetMemory({ key: fact.key }))
                    }
                    size="icon-sm"
                    variant="ghost"
                  >
                    <HugeIcons icon={Cancel01Icon} />
                    <span className="sr-only">{t("memory-forget")}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 pt-4 text-muted-foreground text-sm">
              {t("memory-empty")}
            </p>
          )}
        </CardContent>
      ) : null}
      <CardSectionFooter>
        <div className="flex w-full items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">{t("memory-footer")}</p>
          {memory ? (
            <Button
              disabled={isPending}
              onClick={() => setConfirming(true)}
              size="sm"
              variant="outline"
            >
              {t("memory-disable")}
            </Button>
          ) : (
            <Button
              disabled={isPending}
              onClick={() => change(() => enableMemory())}
              size="sm"
            >
              {t("memory-enable")}
            </Button>
          )}
        </div>
      </CardSectionFooter>
      <ResponsiveDialog
        description={t("memory-disable-description")}
        footer={
          <Button
            disabled={isPending}
            onClick={() => {
              setConfirming(false);
              change(() => disableMemory());
            }}
            variant="destructive"
          >
            {t("memory-disable-confirm")}
          </Button>
        }
        open={confirming}
        setOpen={setConfirming}
        title={t("memory-disable-title")}
      />
    </CardSection>
  );
}

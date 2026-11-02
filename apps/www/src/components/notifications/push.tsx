import { QueryResult, useMutation, useQuery } from "@confect/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useEffect, useState } from "react";
import { useTranslations } from "use-intl";
import { reportClientException } from "@/lib/analytics/client";
import {
  type PushState,
  readPushState,
  subscribeDevice,
} from "@/lib/notifications/device";

/**
 * The footer of the notification preferences (ADR 0027): a browser that takes push and has it off
 * gets one button that turns it on after the person's tap; an iPhone or iPad tab says that push
 * works only from the Home Screen. A browser with push on, blocked, or without push says where the
 * preferences live. The inbox stays the source of every notice either way.
 */
export function PushOffer() {
  const t = useTranslations("Notifications");
  const subscribe = useMutation(notifications.push.subscribe);
  const key = useQuery(notifications.push.publicKey, {});
  const publicKey =
    QueryResult.isSuccess(key) && key.value !== null ? key.value : undefined;
  const [state, setState] = useState<typeof PushState.Type | null>(null);

  // The browser is read after the first paint, and again only if the deployment's key changes.
  useEffect(() => {
    Effect.runPromise(readPushState(publicKey)).then(setState);
  }, [publicKey]);

  /** Turns push on at once, and turns it back off with the shared toast when a step fails. */
  const turnOn = () => {
    if (publicKey === undefined) {
      return;
    }
    setState("on");
    Effect.runPromise(
      subscribeDevice(publicKey).pipe(
        Effect.flatMap((keys) =>
          Effect.flatMap(
            Effect.tryPromise(() => subscribe(keys)),
            Effect.fromResult
          )
        ),
        Effect.catch((error) =>
          reportClientException(error, {
            source: "components/notifications/push",
          }).pipe(
            Effect.andThen(
              Effect.sync(() => {
                setState("off");
                toast.error({
                  description: "action-error.description",
                  title: "action-error.title",
                });
              })
            )
          )
        )
      )
    );
  };

  if (state === "homeScreen") {
    return (
      <p className="text-muted-foreground text-sm">{t("push-home-screen")}</p>
    );
  }
  if (state !== "off") {
    return (
      <p className="text-muted-foreground text-sm">{t("preferences-footer")}</p>
    );
  }
  return (
    <>
      <p className="text-muted-foreground text-sm">{t("push-offer")}</p>
      <Button className="shrink-0" onClick={turnOn}>
        <HugeIcons icon={Notification01Icon} />
        {t("push-on")}
      </Button>
    </>
  );
}

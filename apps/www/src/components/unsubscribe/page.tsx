import { useMutation } from "@confect/react";
import { MailRemove01Icon } from "@hugeicons/core-free-icons";
import emails from "@repo/backend/confect/_generated/refs/emails";
import { Button } from "@repo/design-system/components/ui/button";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Effect } from "effect";
import { useOptimistic, useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { EntryShellBody } from "@/components/entry/shell";

/**
 * The page an email's unsubscribe link opens: it asks once, and the press stops the email Nakafa sends the reader on
 * its own, with the token the email carried and no sign-in. It says so at once and keeps it when the server agrees;
 * a link no Nakafa email carried says it does not work, and a connection that failed leaves the question to ask again.
 * Opening the link never unsubscribes, because mail scanners open links.
 */
export function UnsubscribePage({ token }: { token: string | undefined }) {
  const t = useTranslations("Unsubscribe");
  const confirm = useMutation(emails.unsubscribe.requests.confirm);
  const [answer, setAnswer] = useState<"ask" | "done" | "invalid">(
    token === undefined ? "invalid" : "ask"
  );
  const [shown, showAnswer] = useOptimistic(answer);
  const [pending, startTransition] = useTransition();

  if (shown === "invalid") {
    return (
      <EntryShellBody>
        <Nina act="searching" label="" size={96} whole />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold">{t("invalid-title")}</h1>
          <p className="text-muted-foreground">{t("invalid-description")}</p>
        </div>
      </EntryShellBody>
    );
  }
  if (shown === "done") {
    return (
      <EntryShellBody>
        <Nina act="waving" label="" size={96} whole />
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold">{t("done-title")}</h1>
          <p className="text-muted-foreground">{t("done-description")}</p>
        </div>
      </EntryShellBody>
    );
  }
  return (
    <EntryShellBody>
      <Nina act="reading" label="" size={96} whole />
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-xl font-semibold">{t("ask-title")}</h1>
        <p className="text-muted-foreground">{t("ask-description")}</p>
      </div>
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            showAnswer("done");
            const next = await Effect.runPromise(
              Effect.tryPromise(() => confirm({ token: token ?? "" })).pipe(
                Effect.flatMap(Effect.fromResult),
                Effect.as("done" as const),
                Effect.catchTag("UnsubscribeTokenInvalid", () =>
                  Effect.succeed("invalid" as const)
                ),
                Effect.catch(() =>
                  Effect.sync(() => {
                    toast.error(
                      {
                        description: "failure-connection.description",
                        title: "failure-connection.title",
                      },
                      { position: "bottom-center" }
                    );
                    return "ask" as const;
                  })
                )
              )
            );
            setAnswer(next);
          })
        }
        type="button"
      >
        <Spinner icon={MailRemove01Icon} isLoading={pending} />
        {t("confirm")}
      </Button>
    </EntryShellBody>
  );
}

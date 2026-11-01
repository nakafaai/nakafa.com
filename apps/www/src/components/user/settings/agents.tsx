import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import { toast } from "@repo/design-system/lib/toast/notify";
import { useRouter } from "@tanstack/react-router";
import { Array as Arr } from "effect";
import { useOptimistic, useTransition } from "react";
import { useTranslations } from "use-intl";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";
import { readAuthClient } from "@/lib/auth/client";

/**
 * The agents a person let act as them, each with what ends it. Ending one removes its row at
 * once, and the row comes back if the server refuses.
 */
export function UserSettingsAgents({
  agents,
}: {
  readonly agents: readonly {
    readonly clientId: string;
    readonly name: string | null;
  }[];
}) {
  const t = useTranslations("Auth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, remove] = useOptimistic(agents, (rows, clientId: string) =>
    Arr.filter(rows, (row) => row.clientId !== clientId)
  );
  const revoke = (clientId: string) =>
    startTransition(async () => {
      remove(clientId);
      const { error } = await readAuthClient().$fetch("/agent/revoke", {
        body: { client_id: clientId },
        method: "POST",
      });
      if (error) {
        toast.error({
          description: "action-error.description",
          title: "action-error.title",
        });
      }
      await router.invalidate();
    });
  return (
    <CardSection description={t("agents-description")} title={t("agents")}>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("agents-empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {Arr.map(shown, (agent) => (
              <li
                className="flex items-center justify-between gap-2"
                key={agent.clientId}
              >
                <span className="min-w-0 truncate text-sm">
                  {agent.name ?? t("agent-unnamed")}
                </span>
                <Button
                  disabled={pending}
                  onClick={() => revoke(agent.clientId)}
                  size="sm"
                  variant="outline"
                >
                  {t("agents-revoke")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardSectionFooter hint={t("agents-footer")} />
    </CardSection>
  );
}

import {
  type OptimisticUpdate,
  QueryResult,
  useMutation,
  useQuery,
} from "@confect/react";
import { Unlink03Icon } from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Button } from "@repo/design-system/components/ui/button";
import { CardContent } from "@repo/design-system/components/ui/card";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { toast } from "@repo/design-system/lib/toast/notify";
import { Array as Arr, Option, Result } from "effect";
import { useTranslations } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import {
  CardSection,
  CardSectionFooter,
} from "@/components/shared/card/section";

const { list, revoke } = auth.grant;

/** Takes a revoked agent off the list at once; the list comes back if the server refuses. */
const revokeUpdate: OptimisticUpdate<typeof revoke> = (localStore, args) => {
  for (const query of localStore.getAllQueries(list)) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        list,
        query.args,
        Option.some(
          Arr.filter(query.value.value, (row) => row.grantId !== args.grantId)
        )
      );
    }
  }
};

/**
 * The agents a person let act as them, each with what ends it. Ending one
 * removes its row at once, and the row comes back if the server refuses.
 */
export function UserSettingsAgents() {
  const t = useTranslations("Auth");
  const isAuthenticated = useConvexAuth((state) => state.isAuthenticated);
  const agents = useQuery(list, isAuthenticated ? {} : "skip");
  const end = useMutation(revoke).withOptimisticUpdate(revokeUpdate);

  if (QueryResult.isFailure(agents)) {
    throw agents.error;
  }
  if (!QueryResult.isSuccess(agents)) {
    return null;
  }

  return (
    <CardSection description={t("agents-description")} title={t("agents")}>
      <CardContent>
        {agents.value.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("agents-empty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {Arr.map(agents.value, (agent) => (
              <li
                className="flex items-center justify-between gap-2"
                key={agent.grantId}
              >
                <span className="min-w-0 truncate text-sm">{agent.name}</span>
                <Button
                  onClick={async () => {
                    const ended = await end({ grantId: agent.grantId });
                    if (Result.isFailure(ended)) {
                      toast.error({
                        description: "action-error.description",
                        title: "action-error.title",
                      });
                    }
                  }}
                  size="sm"
                  variant="outline"
                >
                  <HugeIcons icon={Unlink03Icon} />
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

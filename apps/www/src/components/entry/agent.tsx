import { useMutation } from "@confect/react";
import { Cancel01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import auth from "@repo/backend/confect/_generated/refs/auth";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Effect, Match, Result } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { type AgentRequest, agentAnswerAddress } from "@/lib/auth/consent";
import { useCurrentAuthNavigation } from "@/lib/auth/location";

const agentRoute = getRouteApi("/$locale/_entry/agent");

/**
 * The consent page's body: the question about the agent that asks, or the
 * refusal of a request that no agent Nakafa knows could have sent.
 */
export function AgentConsent() {
  const consent = agentRoute.useLoaderData();
  if (consent._tag === "Refused") {
    return <AgentRefusal />;
  }
  return <AgentQuestion name={consent.name} request={consent.request} />;
}

/** A request that names no agent Nakafa knows, or that no agent may send. */
function AgentRefusal() {
  const t = useTranslations("Auth");
  return (
    <div className="flex max-w-sm flex-col items-center gap-5 text-center">
      <Nina act="thinking" label="" size={88} whole />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">
          {t("agent-refused-title")}
        </h1>
        <p className="text-muted-foreground">
          {t("agent-refused-description")}
        </p>
      </div>
    </div>
  );
}

/**
 * Asks whether an agent may act as the signed-in person, and sends the browser
 * back to the agent with the answer: a code on Allow, `access_denied` on Deny.
 * The name is the agent's own, unverified, so the page also names the host that
 * the answer goes to. A session that ended on the way signs in again and comes
 * back to the same question.
 */
function AgentQuestion({
  name,
  request,
}: {
  readonly name: string;
  readonly request: typeof AgentRequest.Type;
}) {
  const t = useTranslations("Auth");
  const navigate = useNavigate();
  const authNavigation = useCurrentAuthNavigation();
  const authorize = useMutation(auth.grant.authorize);
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<"failed" | "refused" | null>(null);

  const deny = () =>
    window.location.assign(agentAnswerAddress(request, { _tag: "Denied" }));

  const allow = () =>
    startTransition(async () => {
      const outcome = await Effect.runPromise(
        Effect.tryPromise(() =>
          authorize({
            clientId: request.client_id,
            codeChallenge: request.code_challenge,
            redirectUri: request.redirect_uri,
          })
        ).pipe(Effect.flatMap(Effect.fromResult), Effect.result)
      );
      if (Result.isSuccess(outcome)) {
        window.location.assign(
          agentAnswerAddress(request, {
            _tag: "Allowed",
            code: outcome.success.code,
          })
        );
        return;
      }
      Match.value(outcome.failure).pipe(
        Match.tag("SessionRequired", () =>
          navigate(authNavigation.readTarget())
        ),
        Match.tag("AgentRefused", () =>
          startTransition(() => setFailure("refused"))
        ),
        Match.orElse(() => startTransition(() => setFailure("failed")))
      );
    });

  return (
    <div className="flex max-w-sm flex-col items-center gap-5 text-center">
      <Nina act="writing" label="" size={88} whole />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-balance">
          {t("agent-title", { name })}
        </h1>
        <p className="text-muted-foreground">{t("agent-description")}</p>
        <p className="text-muted-foreground">
          {t("agent-address", { host: new URL(request.redirect_uri).host })}
        </p>
        {failure === null ? null : (
          <p className="text-destructive" role="alert">
            {failure === "refused"
              ? t("agent-refused-description")
              : t("agent-failed")}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button disabled={pending} onClick={deny} variant="outline">
          <HugeIcons icon={Cancel01Icon} />
          {t("agent-deny")}
        </Button>
        <Button disabled={pending || failure === "refused"} onClick={allow}>
          <Spinner icon={CheckmarkCircle02Icon} isLoading={pending} />
          {t("agent-allow")}
        </Button>
      </div>
    </div>
  );
}

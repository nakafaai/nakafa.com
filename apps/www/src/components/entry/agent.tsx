import { Button } from "@repo/design-system/components/ui/button";
import { Nina } from "@repo/design-system/components/ui/nina";
import { Option, Schema } from "effect";
import { useState, useTransition } from "react";
import { useTranslations } from "use-intl";
import { readAuthClient } from "@/lib/auth/client";

/** Better Auth's answer to a consent: where the browser goes next. */
const ConsentAnswer = Schema.Struct({ redirectURI: Schema.String });

/**
 * Asks whether an agent may act as the signed-in person, and sends the browser back to the agent
 * with the answer. The name and the address are the agent's own, unverified, which is why the
 * page shows both.
 */
export function AgentConsent({
  consentCode,
  name,
  redirect,
}: {
  readonly consentCode: string;
  readonly name: string | null;
  readonly redirect: string | null;
}) {
  const t = useTranslations("Auth");
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const answer = (accept: boolean) =>
    startTransition(async () => {
      const { data } = await readAuthClient().$fetch("/oauth2/consent", {
        body: { accept, consent_code: consentCode },
        method: "POST",
      });
      const decoded = Schema.decodeUnknownOption(ConsentAnswer)(data);
      if (Option.isNone(decoded)) {
        setFailed(true);
        return;
      }
      window.location.assign(decoded.value.redirectURI);
    });
  return (
    <div className="flex max-w-sm flex-col items-center gap-5 text-center">
      <Nina act="writing" label="" size={88} whole />
      <div className="flex flex-col gap-2">
        <h1 className="text-balance font-semibold text-2xl">
          {t("agent-title", { name: name ?? t("agent-unnamed") })}
        </h1>
        <p className="text-muted-foreground">{t("agent-description")}</p>
        {redirect === null ? null : (
          <p className="text-muted-foreground">
            {t("agent-address", { host: redirect })}
          </p>
        )}
        {failed ? (
          <p className="text-destructive" role="alert">
            {t("agent-failed")}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() => answer(false)}
          variant="outline"
        >
          {t("agent-deny")}
        </Button>
        <Button disabled={pending} onClick={() => answer(true)}>
          {t("agent-allow")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import type { CapabilityArtifact } from "@repo/backend/confect/nina/capability/progress";
import { cn } from "cn";
import { Match } from "effect";
import { useTranslations } from "next-intl";
import { useActivity } from "@/components/ai/message/activity";
import { getMathIcon } from "@/components/ai/message/evidence/math/icons";
import { MathEvidence } from "@/components/ai/message/evidence/math/result";
import { MathPart } from "@/components/ai/message/evidence/math/view";
import { NakafaPart } from "@/components/ai/message/evidence/nakafa/view";
import { ScrapeUrlPart } from "@/components/ai/message/evidence/scrape";
import { WebSearchPart } from "@/components/ai/message/evidence/web";

/** Renders every persisted artifact of the surrounding live activity. */
export function EvidenceList() {
  const { artifacts } = useActivity();
  return artifacts.map((artifact) => (
    <Evidence artifact={artifact} key={`${artifact.type}:${artifact.id}`} />
  ));
}

function Evidence({ artifact }: { artifact: CapabilityArtifact }) {
  const t = useTranslations("Ai");
  const { denied, failed, running } = useActivity();
  if (artifact.data.status === "loading" && !running) {
    return (
      <p
        className={cn(
          "text-sm",
          failed || denied ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {t("activity.stopped")}
      </p>
    );
  }
  return Match.value(artifact).pipe(
    Match.discriminatorsExhaustive("type")({
      "data-math": ({ data }) => (
        <MathPart icon={getMathIcon(data.kind)} message={data}>
          <MathEvidence message={data} />
        </MathPart>
      ),
      "data-nakafa": ({ data }) => <NakafaPart message={data} />,
      "data-scrape-url": ({ data }) => <ScrapeUrlPart message={data} />,
      "data-web-search": ({ data }) => <WebSearchPart message={data} />,
    })
  );
}

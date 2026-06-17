import { Badge } from "@repo/design-system/components/ui/badge";
import type { ReactNode } from "react";
import {
  TryoutCard,
  TryoutCardArt,
  TryoutCardBody,
  TryoutCardContent,
  TryoutCardCopy,
  TryoutCardHero,
  TryoutCardTitle,
} from "@/components/tryout/shared/card";

/** Renders the shared catalog card used by tryout hub and product routes. */
export function TryoutCatalogCard({
  action,
  activeCountLabel,
  art,
  children,
  title,
}: {
  action?: ReactNode;
  activeCountLabel: string;
  art: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <TryoutCard>
      <TryoutCardHero>
        <TryoutCardArt>{art}</TryoutCardArt>

        <TryoutCardBody className={action ? undefined : "gap-0"}>
          <TryoutCardCopy>
            <div className="flex flex-wrap items-center gap-2">
              <TryoutCardTitle>{title}</TryoutCardTitle>
              <Badge variant="outline">{activeCountLabel}</Badge>
            </div>
          </TryoutCardCopy>

          {action ? <div>{action}</div> : null}
        </TryoutCardBody>
      </TryoutCardHero>

      <TryoutCardContent>{children}</TryoutCardContent>
    </TryoutCard>
  );
}

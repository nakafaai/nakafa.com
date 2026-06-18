import { Badge } from "@repo/design-system/components/ui/badge";
import type { ReactNode } from "react";
import {
  TryoutCard,
  TryoutCardArt,
  TryoutCardBody,
  TryoutCardContent,
  TryoutCardCopy,
  TryoutCardDescription,
  TryoutCardHero,
  TryoutCardTitle,
} from "@/components/tryout/shared/card";

/** Renders the shared catalog card used by tryout hub and product routes. */
export function TryoutCatalogCard({
  action,
  activeCountLabel,
  art,
  children,
  description,
  title,
}: {
  action?: ReactNode;
  activeCountLabel: string;
  art: ReactNode;
  children: ReactNode;
  description: string;
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

            <TryoutCardDescription>{description}</TryoutCardDescription>
          </TryoutCardCopy>

          {action ? <div>{action}</div> : null}
        </TryoutCardBody>
      </TryoutCardHero>

      <TryoutCardContent>{children}</TryoutCardContent>
    </TryoutCard>
  );
}

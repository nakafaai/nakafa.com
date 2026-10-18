"use client";

import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { CardSection } from "@/components/shared/card/section";
import {
  type PersonId,
  SchoolPersonPicker,
} from "@/components/tenant/settings/people";

/** Renders the card that holds the picker of the person whose access a settings page shows. */
export function SchoolPersonCard({
  description,
  onChoose,
  personId,
  slug,
  title,
}: {
  description: string;
  onChoose: (personId: PersonId) => void;
  personId: PersonId | undefined;
  slug: TenantSlug;
  title: string;
}) {
  return (
    <CardSection>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <SchoolPersonPicker
          onChoose={onChoose}
          personId={personId}
          slug={slug}
        />
      </CardContent>
    </CardSection>
  );
}

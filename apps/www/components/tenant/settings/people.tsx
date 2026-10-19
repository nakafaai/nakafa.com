"use client";

import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { Id } from "@repo/backend/confect/_generated/id";
import tenancy from "@repo/backend/confect/_generated/refs/tenancy";
import type { TenantSlug } from "@repo/backend/confect/tenancy/slug";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Array as Arr, Option, Schema } from "effect";
import { useTranslations } from "next-intl";
import { DataFailure } from "@/components/shared/failure";
import { reloadPage } from "@/components/shared/reload";
import { ReadBoundary } from "@/components/tenant/read/boundary";

/** How many people one page of the picker loads, and each page after it. */
const PICKER_SIZE = 100;

/** The ID of one Person of the school. */
export type PersonId = PaginatedQueryItem<typeof tenancy.people.list>["id"];

/**
 * Renders the picker of an active person of the school. The list loads more people
 * as its end comes into view. A person is chosen by ID, so a choice the list does
 * not hold never reaches a function.
 */
export function SchoolPersonPicker({
  id,
  onChoose,
  personId,
  slug,
}: {
  /** The ID of the trigger, which the label of the field names. */
  id: string;
  onChoose: (personId: PersonId) => void;
  personId: PersonId | undefined;
  slug: TenantSlug;
}) {
  return (
    <ReadBoundary>
      <SchoolPersonSelect
        id={id}
        onChoose={onChoose}
        personId={personId}
        slug={slug}
      />
    </ReadBoundary>
  );
}

/** The picker's list of active people, read a page at a time. */
function SchoolPersonSelect({
  id,
  onChoose,
  personId,
  slug,
}: {
  id: string;
  onChoose: (personId: PersonId) => void;
  personId: PersonId | undefined;
  slug: TenantSlug;
}) {
  const t = useTranslations("SchoolSettings");
  const pagination = usePaginatedQuery(
    tenancy.people.list,
    { slug, status: "active" },
    { initialNumItems: PICKER_SIZE }
  );

  const items = Arr.map(pagination.results, (person) => ({
    label: person.name,
    value: person.id,
  }));

  return (
    <>
      {PaginatedQueryResult.isFailure(pagination) ? (
        <DataFailure onRetry={reloadPage} />
      ) : null}
      <Select
        items={items}
        onValueChange={(value) => {
          const chosen = Schema.decodeUnknownOption(Id("tenantPeople"))(value);
          if (Option.isSome(chosen)) {
            onChoose(chosen.value);
          }
        }}
        value={personId}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder={t("person-placeholder")} />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Arr.map(items, (item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
          {PaginatedQueryResult.isCanLoadMore(pagination) ? (
            <Intersection
              onIntersect={() => pagination.loadMore(PICKER_SIZE)}
            />
          ) : null}
        </SelectContent>
      </Select>
    </>
  );
}

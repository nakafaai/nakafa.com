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
  onChoose,
  personId,
  slug,
}: {
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

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  const items = Arr.map(pagination.results, (person) => ({
    label: person.name,
    value: person.id,
  }));

  return (
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
      <SelectTrigger className="w-full max-w-xs">
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
          <Intersection onIntersect={() => pagination.loadMore(PICKER_SIZE)} />
        ) : null}
      </SelectContent>
    </Select>
  );
}

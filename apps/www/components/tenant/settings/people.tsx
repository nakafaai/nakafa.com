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
import type { ReactNode } from "react";

/** How many people one page of the picker loads, and each page after it. */
const PICKER_SIZE = 100;

/** The ID of one Person of the school. */
export type PersonId = PaginatedQueryItem<typeof tenancy.people.list>["id"];

/** One Person as the picker lists it: its ID, which a choice names, and its name. */
type PersonItem = Pick<PaginatedQueryItem<typeof tenancy.people.list>, "id" | "name">;

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
  const pagination = usePaginatedQuery(
    tenancy.people.list,
    { slug, status: "active" },
    { initialNumItems: PICKER_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <PersonSelect
      footer={
        PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PICKER_SIZE)} />
        ) : null
      }
      id={id}
      onChoose={onChoose}
      people={pagination.results}
      personId={personId}
    />
  );
}

/**
 * Renders the picker of the students of the school: the active members who hold a student
 * grant. A student is chosen by ID, and the list loads more students as its end comes into view.
 */
export function SchoolStudentPicker({
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
  const pagination = usePaginatedQuery(
    tenancy.people.students,
    { slug },
    { initialNumItems: PICKER_SIZE }
  );

  if (PaginatedQueryResult.isFailure(pagination)) {
    throw pagination.error;
  }

  return (
    <PersonSelect
      footer={
        PaginatedQueryResult.isCanLoadMore(pagination) ? (
          <Intersection onIntersect={() => pagination.loadMore(PICKER_SIZE)} />
        ) : null
      }
      id={id}
      onChoose={onChoose}
      people={pagination.results}
      personId={personId}
    />
  );
}

/**
 * The select of a picker: one option per person, each named by the person's name, and the
 * footer that loads the next page. A person listed twice shows once.
 */
function PersonSelect({
  footer,
  id,
  onChoose,
  people,
  personId,
}: {
  footer: ReactNode;
  id: string;
  onChoose: (personId: PersonId) => void;
  people: readonly PersonItem[];
  personId: PersonId | undefined;
}) {
  const t = useTranslations("SchoolSettings");
  const items = Arr.map(
    Arr.dedupeWith(people, (first, second) => first.id === second.id),
    (person) => ({ label: person.name, value: person.id })
  );

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
        {footer}
      </SelectContent>
    </Select>
  );
}

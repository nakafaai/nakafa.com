import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/design-system/components/ui/empty";
import { Spinner } from "@repo/design-system/components/ui/spinner";
import type { ReactNode } from "react";

/** Renders the shared empty-state shell used across Nakafa School screens. */
export function SchoolContentState({
  description,
  media,
  title,
}: {
  description: string;
  media?: ReactNode;
  title: string;
}) {
  return (
    <Empty className="rounded-md border bg-card px-6 py-12 shadow-sm">
      <EmptyHeader>
        {media ? <EmptyMedia variant="icon">{media}</EmptyMedia> : null}
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Renders the shared loading state for class and school content sections. */
export function SchoolContentLoading({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <SchoolContentState
      description={description}
      media={<Spinner aria-hidden="true" />}
      title={title}
    />
  );
}

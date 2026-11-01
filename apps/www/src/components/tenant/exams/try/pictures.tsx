import { QueryResult, useQuery } from "@confect/react";
import exams from "@repo/backend/confect/_generated/refs/exams";
import { Array as Arr } from "effect";
import { type ReactNode, useMemo } from "react";
import {
  addressesOf,
  pictureIdsOfDocuments,
  SittingPictures,
} from "@/components/exams/sitting/pictures";
import {
  useTryExamId,
  useTrySlug,
} from "@/components/tenant/exams/try/context";

/** Resolves the images of `documents` in one read, as a sitting's question does, for the documents inside it. */
export function TryPictures({
  children,
  documents,
}: {
  readonly children: ReactNode;
  readonly documents: readonly unknown[];
}) {
  const examId = useTryExamId();
  const slug = useTrySlug();
  const assets = useMemo(() => pictureIdsOfDocuments(documents), [documents]);
  const reply = useQuery(
    exams.assets.urls,
    Arr.isReadonlyArrayEmpty(assets) ? "skip" : { assets, examId, slug }
  );
  const addresses = useMemo(
    () => (QueryResult.isSuccess(reply) ? addressesOf(reply.value) : {}),
    [reply]
  );

  return <SittingPictures value={addresses}>{children}</SittingPictures>;
}

import { encodeJsonText } from "@repo/utilities/json";
import type {
  TryoutSetListArgs,
  TryoutSetRequest,
} from "@/components/tryout/catalog/table/types";

/**
 * Identifies one filter and sort of one track, so every window of the same selection
 * shares it. The track is part of the identity, so a response for another track or
 * locale never commits to this selection.
 */
export function selectionKey(args: TryoutSetRequest) {
  return encodeJsonText([
    args.countryKey,
    args.examKey,
    args.locale,
    args.trackKey,
    args.filter,
    args.sort.field,
    args.sort.direction,
  ]);
}

/** Identifies one request: its selection and the number of rows it reads. */
export function requestKey(args: TryoutSetListArgs) {
  return encodeJsonText([selectionKey(args), args.paginationOpts.numItems]);
}

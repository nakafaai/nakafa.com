import { encodeJsonText } from "@repo/utilities/json";
import type {
  TryoutSetListArgs,
  TryoutSetRequest,
} from "@/components/tryout/catalog/table/types";

/** Identifies one filter and sort, so every window of the same selection shares it. */
export function selectionKey(args: TryoutSetRequest) {
  return encodeJsonText([args.filter, args.sort.field, args.sort.direction]);
}

/** Identifies one request: its selection and the number of rows it reads. */
export function requestKey(args: TryoutSetListArgs) {
  return encodeJsonText([selectionKey(args), args.paginationOpts.numItems]);
}

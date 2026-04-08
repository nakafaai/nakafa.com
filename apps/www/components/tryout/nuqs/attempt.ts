import { createLoader, parseAsString } from "nuqs/server";

export const tryoutSearchParsers = {
  attempt: parseAsString,
};

export const loadTryoutSearchParams = createLoader(tryoutSearchParsers);

/** Build one tryout route href that preserves the selected historical attempt. */
export function getTryoutHistoryHref(
  pathname: string,
  attemptId?: string | null
) {
  if (!attemptId) {
    return pathname;
  }

  const searchParams = new URLSearchParams({
    attempt: attemptId,
  });

  return `${pathname}?${searchParams.toString()}`;
}

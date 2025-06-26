import type { Content } from "@repo/contents/_types/content";
import { fetcher } from "../lib/fetcher";
import type { Base, FetchResult } from "../lib/types";
import { validateContents } from "../validation/contents";

const PREFIX = "/contents";

export async function getContents({
  slug,
  ...base
}: { slug: string } & Base): Promise<FetchResult<Content[]>> {
  const url = `${PREFIX}/${slug}`;
  const { data, error } = await fetcher<Content[]>(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...base,
  });

  if (error) {
    return {
      data: [],
      error,
    };
  }

  const { parsed, error: validationError } = validateContents(url, data);

  if (validationError) {
    return {
      data: [],
      error: {
        status: 400,
        message: validationError,
      },
    };
  }

  return {
    data: parsed,
    error,
  };
}

import { cleanSlug } from "@repo/connection/lib/utils";
import type { Content } from "@repo/contents/_types/content";
import { fetcher } from "../lib/fetcher";
import type { Base, FetchResult } from "../lib/types";
import { validateContent, validateContents } from "../validation/contents";

const PREFIX = "/contents";

export const contents = {
  getContents,
  getContent,
};

async function getContents({
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

async function getContent({
  slug,
  ...base
}: { slug: string } & Base): Promise<FetchResult<string>> {
  const url = `${PREFIX}/${cleanSlug(slug)}`;
  const { data, error } = await fetcher<Content[]>(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    ...base,
  });

  if (error) {
    return {
      data: "",
      error,
    };
  }

  // find the content with the slug
  const content = data?.find((c) => c.slug === slug);

  if (!content) {
    return {
      data: "",
      error: {
        status: 404,
        message: "Content not found",
      },
    };
  }

  const { parsed, error: validationError } = validateContent(url, content);

  if (validationError) {
    return {
      data: "",
      error: {
        status: 400,
        message: validationError,
      },
    };
  }

  return {
    data: parsed?.raw ?? "",
    error,
  };
}

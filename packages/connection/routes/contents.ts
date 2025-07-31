import { cleanSlug } from "@repo/connection/lib/utils";
import type { Content } from "@repo/contents/_types/content";
import type { Surah } from "@repo/contents/_types/quran";
import { fetcher } from "../lib/fetcher";
import type { FetchResult } from "../lib/types";

const PREFIX = "/contents";

export const contents = {
  getContents,
  getContent,
  getSurah,
};

async function getContents({
  slug,
  ...base
}: { slug: string } & RequestInit): Promise<FetchResult<Content[]>> {
  const url = `${PREFIX}/${slug}`;
  const { data, error } = await fetcher<Content[]>(url, {
    method: "GET",
    ...base,
  });

  if (error) {
    return {
      data: [],
      error,
    };
  }

  if (!data) {
    return {
      data: [],
      error: {
        status: 404,
        message: "Contents not found",
      },
    };
  }

  return {
    data,
    error,
  };
}

async function getContent({
  slug,
  ...base
}: {
  slug: string;
} & RequestInit): Promise<FetchResult<string>> {
  const url = `${PREFIX}/${cleanSlug(slug)}`;
  const { data, error } = await fetcher<Content[]>(url, {
    method: "GET",
    ...base,
  });

  if (error) {
    return {
      data: "",
      error,
    };
  }

  // find the content with the slug
  const content = data?.find((c) => c.slug === cleanSlug(slug));

  if (!content) {
    return {
      data: "",
      error: {
        status: 404,
        message: "Content not found",
      },
    };
  }

  return {
    data: content.raw,
    error,
  };
}

async function getSurah({
  surah,
  ...base
}: {
  surah: number;
} & RequestInit): Promise<FetchResult<Surah | null>> {
  const url = `${PREFIX}/quran/${surah}`;
  const { data, error } = await fetcher<Surah>(url, {
    method: "GET",
    ...base,
  });

  if (error) {
    return {
      data: null,
      error,
    };
  }

  return {
    data,
    error,
  };
}

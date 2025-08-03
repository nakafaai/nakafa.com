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
  withRaw = true,
  ...base
}: { slug: string; withRaw?: boolean } & RequestInit): Promise<
  FetchResult<Content[]>
> {
  const url = `${PREFIX}/${cleanSlug(slug)}`;
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

  if (!withRaw) {
    return {
      data: data.map((item) => ({ ...item, raw: "" })),
      error,
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
  const cleanedSlug = cleanSlug(slug);
  const url = `${PREFIX}/${cleanedSlug}`;
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

  const content = data?.find(
    (c) => cleanSlug(`/${c.locale}/${c.slug}`) === cleanedSlug
  );

  if (!content) {
    return {
      data: "",
      error: {
        status: 404,
        message: "Content not found. Please find another content.",
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

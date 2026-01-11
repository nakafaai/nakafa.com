import { fetcher } from "@repo/connection/lib/fetcher";
import type { FetchResult } from "@repo/connection/lib/types";
import type { Content } from "@repo/contents/_types/content";
import type {
  Exercise,
  ExerciseWithoutDefaults,
} from "@repo/contents/_types/exercises/shared";
import type { Surah } from "@repo/contents/_types/quran";
import { cleanSlug } from "@repo/utilities/helper";

const PREFIX = "/contents";

export const contents = {
  getContents,
  getContent,
  getSurah,
  getExercises,
};

async function getContents({
  slug,
  withRaw = true,
  ...base
}: { slug: string; withRaw?: boolean } & RequestInit): Promise<
  FetchResult<Content[]>
> {
  const { data, error } = await fetcher<Content[]>({
    endpoint: `${PREFIX}/${cleanSlug(slug)}`,
    options: {
      method: "GET",
      ...base,
    },
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
        message: "Contents not found.",
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
} & RequestInit): Promise<FetchResult<Content | null>> {
  const cleanedSlug = cleanSlug(slug);
  const { data, error } = await fetcher<Content[]>({
    endpoint: `${PREFIX}/${cleanedSlug}`,
    options: {
      method: "GET",
      ...base,
    },
  });

  if (error) {
    return {
      data: null,
      error,
    };
  }

  const content = data?.find(
    (c) => cleanSlug(`/${c.locale}/${c.slug}`) === cleanedSlug
  );

  if (!content) {
    return {
      data: null,
      error: {
        status: 404,
        message: "Content not found. Please find another content.",
      },
    };
  }

  return {
    data: content,
    error,
  };
}

async function getSurah({
  surah,
  ...base
}: {
  surah: number;
} & RequestInit): Promise<FetchResult<Surah | null>> {
  const { data, error } = await fetcher<Surah>({
    endpoint: `${PREFIX}/quran/${surah}`,
    options: {
      method: "GET",
      ...base,
    },
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

async function getExercises({
  slug,
  withRaw = true,
  ...base
}: {
  slug: string;
  withRaw?: boolean;
} & RequestInit): Promise<FetchResult<ExerciseWithoutDefaults[] | null>> {
  const cleanedSlug = cleanSlug(slug);
  const { data, error } = await fetcher<Exercise[]>({
    endpoint: `${PREFIX}/${cleanedSlug}`,
    options: {
      method: "GET",
      ...base,
    },
  });

  if (error) {
    return {
      data: null,
      error,
    };
  }

  if (!data) {
    return {
      data: null,
      error: {
        status: 404,
        message: "Exercises not found.",
      },
    };
  }

  const processedData: ExerciseWithoutDefaults[] = data.map((item) => ({
    ...item,
    question: {
      metadata: item.question.metadata,
      raw: withRaw ? item.question.raw : "",
    },
    answer: {
      metadata: item.answer.metadata,
      raw: withRaw ? item.answer.raw : "",
    },
  }));

  return {
    data: processedData,
    error,
  };
}

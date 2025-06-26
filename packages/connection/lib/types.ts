export type FetchError = {
  status: number;
  message: string;
};

export type FetchResult<T> = {
  data: T;
  error: FetchError | null;
};

export type Base = {
  cache?: "no-store" | "force-cache";
  signal?: AbortSignal;
};

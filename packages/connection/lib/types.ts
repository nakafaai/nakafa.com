export interface FetchError {
  status: number;
  message: string;
}

export interface FetchResult<T> {
  data: T;
  error: FetchError | null;
}

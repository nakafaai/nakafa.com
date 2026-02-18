export interface FetchError {
  message: string;
  status: number;
}

export interface FetchResult<T> {
  data: T;
  error: FetchError | null;
}

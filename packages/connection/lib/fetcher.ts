import type { FetchResult } from "@repo/connection/lib/types";
import ky, { HTTPError, TimeoutError } from "ky";

const url =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3002"
    : "https://api.nakafa.com";

const URL_DETAILS_REGEX = /:.*$/;

export async function fetcher<T>(
  endpoint: string,
  options: RequestInit
): Promise<FetchResult<T | null>> {
  try {
    const response = await ky<T>(`${url}${endpoint}`, {
      ...options,
    }).json();

    return { data: response, error: null };
  } catch (error) {
    if (error instanceof TimeoutError) {
      return {
        data: null,
        error: {
          status: 408,
          message: "Request timed out. Please try again later.",
        },
      };
    }

    if (error instanceof SyntaxError) {
      return { data: null, error: null };
    }

    if (error instanceof HTTPError) {
      return {
        data: null,
        error: {
          status: error.response.status,
          message: error.message.replace(URL_DETAILS_REGEX, ""),
        },
      };
    }

    return {
      data: null,
      error: {
        status: 500,
        message: "Internal server error.",
      },
    };
  }
}

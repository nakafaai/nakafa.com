import type { FetchResult } from "@repo/connection/lib/types";
import ky, { HTTPError, TimeoutError } from "ky";

const defaultBaseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3002"
    : "https://api.nakafa.com";

const URL_DETAILS_REGEX = /:.*$/;

/**
 * Universal fetcher function for making HTTP requests to API endpoints.
 *
 * By default, uses the Nakafa API (https://api.nakafa.com in production or http://localhost:3002 in development).
 * If you have a custom base URL, you can specify it using the `url` parameter.
 *
 * @template T - The expected response data type
 * @param {Object} params - The fetcher parameters
 * @param {string} [params.url] - Custom base URL. If not provided, defaults to the Nakafa API
 * @param {string} params.endpoint - The API endpoint path (e.g., "/contents/subject")
 * @param {RequestInit} params.options - Fetch options (method, headers, body, etc.)
 * @returns {Promise<FetchResult<T | null>>} Object containing either data or error
 *
 * @example
 * // Using default API
 * const result = await fetcher({
 *   endpoint: "/contents/subject",
 *   options: { method: "GET" }
 * });
 *
 * @example
 * // Using custom base URL
 * const result = await fetcher({
 *   url: "https://custom-api.example.com",
 *   endpoint: "/data",
 *   options: { method: "GET" }
 * });
 */
export async function fetcher<T>({
  url = defaultBaseUrl,
  endpoint,
  options,
}: {
  url?: string;
  endpoint: string;
  options: RequestInit;
}): Promise<FetchResult<T | null>> {
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

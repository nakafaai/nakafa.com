import "server-only";

import { keys } from "@repo/connection/keys";
import type { FetchResult } from "@repo/connection/lib/types";
import ky, { HTTPError, TimeoutError } from "ky";

const LOCAL_API_URL = "http://localhost:3002";
const PRODUCTION_API_URL = "https://api.nakafa.com";

/**
 * Checks if the local API is available by performing a HEAD request.
 * Times out after 1 second.
 * @returns {Promise<boolean>} True if local API is available, false otherwise
 */
async function isLocalApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(LOCAL_API_URL, {
      method: "HEAD",
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Determines the base URL to use for API requests.
 * In development, defaults to http://localhost:3002.
 * In production, checks if the local API is available and uses it if so.
 * Falls back to https://api.nakafa.com.
 * @returns {Promise<string>} The base URL to use for API requests
 */
async function getBaseUrl(): Promise<string> {
  if (process.env.NODE_ENV === "development") {
    return LOCAL_API_URL;
  }
  const isAvailable = await isLocalApiAvailable();
  return isAvailable ? LOCAL_API_URL : PRODUCTION_API_URL;
}

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
  url,
  endpoint,
  options,
}: {
  url?: string;
  endpoint: string;
  options: RequestInit;
}): Promise<FetchResult<T | null>> {
  const baseUrl = url ?? (await getBaseUrl());
  const { INTERNAL_CONTENT_API_KEY } = keys();
  try {
    const response = await ky<T>(`${baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${INTERNAL_CONTENT_API_KEY}`,
      },
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

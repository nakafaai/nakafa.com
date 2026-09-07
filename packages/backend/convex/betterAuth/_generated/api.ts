/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";
import type { GenericId as Id } from "convex/values";
import { anyApi, componentsGeneric } from "convex/server";

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: {
  adapter: {
    create: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              data: {
                createdAt: number;
                displayUsername?: null | string;
                email: string;
                emailVerified: boolean;
                image?: null | string;
                name: string;
                updatedAt: number;
                userId?: null | string;
                username?: null | string;
              };
              model: "user";
            }
          | {
              data: {
                createdAt: number;
                expiresAt: number;
                ipAddress?: null | string;
                token: string;
                updatedAt: number;
                userAgent?: null | string;
                userId: string;
              };
              model: "session";
            }
          | {
              data: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId: string;
                createdAt: number;
                idToken?: null | string;
                password?: null | string;
                providerId: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt: number;
                userId: string;
              };
              model: "account";
            }
          | {
              data: {
                createdAt: number;
                expiresAt: number;
                identifier: string;
                updatedAt: number;
                value: string;
              };
              model: "verification";
            }
          | {
              data: {
                createdAt: number;
                expiresAt?: null | number;
                privateKey: string;
                publicKey: string;
              };
              model: "jwks";
            };
        onCreateHandle?: string;
        select?: Array<string>;
      },
      any
    >;
    deleteMany: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onDeleteHandle?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      any
    >;
    deleteOne: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onDeleteHandle?: string;
      },
      any
    >;
    findMany: FunctionReference<
      "query",
      "public",
      {
        join?: any;
        limit?: number;
        model: "user" | "session" | "account" | "verification" | "jwks";
        offset?: number;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
        select?: Array<string>;
        sortBy?: { direction: "asc" | "desc"; field: string };
        where?: Array<{
          connector?: "AND" | "OR";
          field: string;
          mode?: "sensitive" | "insensitive";
          operator?:
            | "lt"
            | "lte"
            | "gt"
            | "gte"
            | "eq"
            | "in"
            | "not_in"
            | "ne"
            | "contains"
            | "starts_with"
            | "ends_with";
          value:
            string | number | boolean | Array<string> | Array<number> | null;
        }>;
      },
      any
    >;
    findOne: FunctionReference<
      "query",
      "public",
      {
        join?: any;
        model: "user" | "session" | "account" | "verification" | "jwks";
        select?: Array<string>;
        where?: Array<{
          connector?: "AND" | "OR";
          field: string;
          mode?: "sensitive" | "insensitive";
          operator?:
            | "lt"
            | "lte"
            | "gt"
            | "gte"
            | "eq"
            | "in"
            | "not_in"
            | "ne"
            | "contains"
            | "starts_with"
            | "ends_with";
          value:
            string | number | boolean | Array<string> | Array<number> | null;
        }>;
      },
      any
    >;
    updateMany: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              update: {
                createdAt?: number;
                displayUsername?: null | string;
                email?: string;
                emailVerified?: boolean;
                image?: null | string;
                name?: string;
                updatedAt?: number;
                userId?: null | string;
                username?: null | string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              update: {
                createdAt?: number;
                expiresAt?: number;
                ipAddress?: null | string;
                token?: string;
                updatedAt?: number;
                userAgent?: null | string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              update: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId?: string;
                createdAt?: number;
                idToken?: null | string;
                password?: null | string;
                providerId?: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt?: number;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              update: {
                createdAt?: number;
                expiresAt?: number;
                identifier?: string;
                updatedAt?: number;
                value?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              update: {
                createdAt?: number;
                expiresAt?: null | number;
                privateKey?: string;
                publicKey?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onUpdateHandle?: string;
        paginationOpts: {
          cursor: string | null;
          endCursor?: string | null;
          id?: number;
          maximumBytesRead?: number;
          maximumRowsRead?: number;
          numItems: number;
        };
      },
      any
    >;
    updateOne: FunctionReference<
      "mutation",
      "public",
      {
        input:
          | {
              model: "user";
              update: {
                createdAt?: number;
                displayUsername?: null | string;
                email?: string;
                emailVerified?: boolean;
                image?: null | string;
                name?: string;
                updatedAt?: number;
                userId?: null | string;
                username?: null | string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "name"
                  | "email"
                  | "emailVerified"
                  | "image"
                  | "createdAt"
                  | "updatedAt"
                  | "username"
                  | "displayUsername"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "session";
              update: {
                createdAt?: number;
                expiresAt?: number;
                ipAddress?: null | string;
                token?: string;
                updatedAt?: number;
                userAgent?: null | string;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "expiresAt"
                  | "token"
                  | "createdAt"
                  | "updatedAt"
                  | "ipAddress"
                  | "userAgent"
                  | "userId"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "account";
              update: {
                accessToken?: null | string;
                accessTokenExpiresAt?: null | number;
                accountId?: string;
                createdAt?: number;
                idToken?: null | string;
                password?: null | string;
                providerId?: string;
                refreshToken?: null | string;
                refreshTokenExpiresAt?: null | number;
                scope?: null | string;
                updatedAt?: number;
                userId?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "accountId"
                  | "providerId"
                  | "userId"
                  | "accessToken"
                  | "refreshToken"
                  | "idToken"
                  | "accessTokenExpiresAt"
                  | "refreshTokenExpiresAt"
                  | "scope"
                  | "password"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "verification";
              update: {
                createdAt?: number;
                expiresAt?: number;
                identifier?: string;
                updatedAt?: number;
                value?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "identifier"
                  | "value"
                  | "expiresAt"
                  | "createdAt"
                  | "updatedAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            }
          | {
              model: "jwks";
              update: {
                createdAt?: number;
                expiresAt?: null | number;
                privateKey?: string;
                publicKey?: string;
              };
              where?: Array<{
                connector?: "AND" | "OR";
                field:
                  | "publicKey"
                  | "privateKey"
                  | "createdAt"
                  | "expiresAt"
                  | "_id";
                mode?: "sensitive" | "insensitive";
                operator?:
                  | "lt"
                  | "lte"
                  | "gt"
                  | "gte"
                  | "eq"
                  | "in"
                  | "not_in"
                  | "ne"
                  | "contains"
                  | "starts_with"
                  | "ends_with";
                value:
                  | string
                  | number
                  | boolean
                  | Array<string>
                  | Array<number>
                  | null;
              }>;
            };
        onUpdateHandle?: string;
      },
      any
    >;
  };
  deletion: {
    deleteUserVerificationPage: FunctionReference<
      "mutation",
      "public",
      { authId: string; cursor: null | string },
      { continueCursor: string; isDone: boolean }
    >;
  };
  mutations: {
    setUserId: FunctionReference<
      "mutation",
      "public",
      { authId: string; userId: string },
      null
    >;
    updateUserName: FunctionReference<
      "mutation",
      "public",
      { authId: string; name: string },
      null
    >;
  };
  queries: {
    getUserByEmail: FunctionReference<
      "query",
      "public",
      { email: string },
      null | { _id: Id<"user"> }
    >;
  };
  retirement: {
    audit: FunctionReference<
      "query",
      "public",
      { cursor: null | string; target: "credentials" | "resets" | "usernames" },
      {
        blocked: number;
        continueCursor: string;
        isDone: boolean;
        matched: number;
        scanned: number;
      }
    >;
    retire: FunctionReference<
      "mutation",
      "public",
      { cursor: null | string; target: "credentials" | "resets" | "usernames" },
      {
        blocked: number;
        continueCursor: string;
        isDone: boolean;
        matched: number;
        retired: number;
        scanned: number;
      }
    >;
  };
} = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: {} = anyApi as any;

export const components = componentsGeneric() as unknown as {};

/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    adapter: {
      create: FunctionReference<
        "mutation",
        "internal",
        {
          input:
            | {
                data: {
                  createdAt: number;
                  displayUsername?: null | string;
                  email: string;
                  emailVerified: boolean;
                  image?: null | string;
                  isAnonymous?: null | boolean;
                  name: string;
                  updatedAt: number;
                  userId?: null | string;
                  username?: null | string;
                };
                model: "user";
              }
            | {
                data: {
                  activeOrganizationId?: null | string;
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
                  logo?: null | string;
                  metadata?: null | string;
                  name: string;
                  slug: string;
                };
                model: "organization";
              }
            | {
                data: {
                  createdAt: number;
                  organizationId: string;
                  role: string;
                  userId: string;
                };
                model: "member";
              }
            | {
                data: {
                  email: string;
                  expiresAt: number;
                  inviterId: string;
                  organizationId: string;
                  role?: null | string;
                  status: string;
                };
                model: "invitation";
              }
            | {
                data: {
                  createdAt: number;
                  enabled?: null | boolean;
                  expiresAt?: null | number;
                  key: string;
                  lastRefillAt?: null | number;
                  lastRequest?: null | number;
                  metadata?: null | string;
                  name?: null | string;
                  permissions?: null | string;
                  prefix?: null | string;
                  rateLimitEnabled?: null | boolean;
                  rateLimitMax?: null | number;
                  rateLimitTimeWindow?: null | number;
                  refillAmount?: null | number;
                  refillInterval?: null | number;
                  remaining?: null | number;
                  requestCount?: null | number;
                  start?: null | string;
                  updatedAt: number;
                  userId: string;
                };
                model: "apikey";
              }
            | {
                data: {
                  createdAt: number;
                  privateKey: string;
                  publicKey: string;
                };
                model: "jwks";
              }
            | {
                data: { count: number; key: string; lastRequest: number };
                model: "rateLimit";
              };
          onCreateHandle?: string;
          select?: Array<string>;
        },
        any,
        Name
      >;
      deleteMany: FunctionReference<
        "mutation",
        "internal",
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
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "userId"
                    | "_id";
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
                    | "activeOrganizationId"
                    | "_id";
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
                model: "organization";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "slug"
                    | "logo"
                    | "createdAt"
                    | "metadata"
                    | "_id";
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
                model: "member";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "userId"
                    | "role"
                    | "createdAt"
                    | "_id";
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
                model: "invitation";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "email"
                    | "role"
                    | "status"
                    | "expiresAt"
                    | "inviterId"
                    | "_id";
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
                model: "apikey";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "start"
                    | "prefix"
                    | "key"
                    | "userId"
                    | "refillInterval"
                    | "refillAmount"
                    | "lastRefillAt"
                    | "enabled"
                    | "rateLimitEnabled"
                    | "rateLimitTimeWindow"
                    | "rateLimitMax"
                    | "requestCount"
                    | "remaining"
                    | "lastRequest"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "permissions"
                    | "metadata"
                    | "_id";
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
                  field: "publicKey" | "privateKey" | "createdAt" | "_id";
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
                model: "rateLimit";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
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
        any,
        Name
      >;
      deleteOne: FunctionReference<
        "mutation",
        "internal",
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
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "userId"
                    | "_id";
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
                    | "activeOrganizationId"
                    | "_id";
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
                model: "organization";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "slug"
                    | "logo"
                    | "createdAt"
                    | "metadata"
                    | "_id";
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
                model: "member";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "userId"
                    | "role"
                    | "createdAt"
                    | "_id";
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
                model: "invitation";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "email"
                    | "role"
                    | "status"
                    | "expiresAt"
                    | "inviterId"
                    | "_id";
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
                model: "apikey";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "start"
                    | "prefix"
                    | "key"
                    | "userId"
                    | "refillInterval"
                    | "refillAmount"
                    | "lastRefillAt"
                    | "enabled"
                    | "rateLimitEnabled"
                    | "rateLimitTimeWindow"
                    | "rateLimitMax"
                    | "requestCount"
                    | "remaining"
                    | "lastRequest"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "permissions"
                    | "metadata"
                    | "_id";
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
                  field: "publicKey" | "privateKey" | "createdAt" | "_id";
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
                model: "rateLimit";
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
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
        any,
        Name
      >;
      findMany: FunctionReference<
        "query",
        "internal",
        {
          limit?: number;
          model:
            | "user"
            | "session"
            | "account"
            | "verification"
            | "organization"
            | "member"
            | "invitation"
            | "apikey"
            | "jwks"
            | "rateLimit";
          offset?: number;
          paginationOpts: {
            cursor: string | null;
            endCursor?: string | null;
            id?: number;
            maximumBytesRead?: number;
            maximumRowsRead?: number;
            numItems: number;
          };
          sortBy?: { direction: "asc" | "desc"; field: string };
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
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
        },
        any,
        Name
      >;
      findOne: FunctionReference<
        "query",
        "internal",
        {
          model:
            | "user"
            | "session"
            | "account"
            | "verification"
            | "organization"
            | "member"
            | "invitation"
            | "apikey"
            | "jwks"
            | "rateLimit";
          select?: Array<string>;
          where?: Array<{
            connector?: "AND" | "OR";
            field: string;
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
        },
        any,
        Name
      >;
      migrationRemoveUserId: FunctionReference<
        "mutation",
        "internal",
        { userId: string },
        any,
        Name
      >;
      updateMany: FunctionReference<
        "mutation",
        "internal",
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
                  isAnonymous?: null | boolean;
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
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "userId"
                    | "_id";
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
                  activeOrganizationId?: null | string;
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
                    | "activeOrganizationId"
                    | "_id";
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
                model: "organization";
                update: {
                  createdAt?: number;
                  logo?: null | string;
                  metadata?: null | string;
                  name?: string;
                  slug?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "slug"
                    | "logo"
                    | "createdAt"
                    | "metadata"
                    | "_id";
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
                model: "member";
                update: {
                  createdAt?: number;
                  organizationId?: string;
                  role?: string;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "userId"
                    | "role"
                    | "createdAt"
                    | "_id";
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
                model: "invitation";
                update: {
                  email?: string;
                  expiresAt?: number;
                  inviterId?: string;
                  organizationId?: string;
                  role?: null | string;
                  status?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "email"
                    | "role"
                    | "status"
                    | "expiresAt"
                    | "inviterId"
                    | "_id";
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
                model: "apikey";
                update: {
                  createdAt?: number;
                  enabled?: null | boolean;
                  expiresAt?: null | number;
                  key?: string;
                  lastRefillAt?: null | number;
                  lastRequest?: null | number;
                  metadata?: null | string;
                  name?: null | string;
                  permissions?: null | string;
                  prefix?: null | string;
                  rateLimitEnabled?: null | boolean;
                  rateLimitMax?: null | number;
                  rateLimitTimeWindow?: null | number;
                  refillAmount?: null | number;
                  refillInterval?: null | number;
                  remaining?: null | number;
                  requestCount?: null | number;
                  start?: null | string;
                  updatedAt?: number;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "start"
                    | "prefix"
                    | "key"
                    | "userId"
                    | "refillInterval"
                    | "refillAmount"
                    | "lastRefillAt"
                    | "enabled"
                    | "rateLimitEnabled"
                    | "rateLimitTimeWindow"
                    | "rateLimitMax"
                    | "requestCount"
                    | "remaining"
                    | "lastRequest"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "permissions"
                    | "metadata"
                    | "_id";
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
                  privateKey?: string;
                  publicKey?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "publicKey" | "privateKey" | "createdAt" | "_id";
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
                model: "rateLimit";
                update: { count?: number; key?: string; lastRequest?: number };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
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
        any,
        Name
      >;
      updateOne: FunctionReference<
        "mutation",
        "internal",
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
                  isAnonymous?: null | boolean;
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
                    | "isAnonymous"
                    | "username"
                    | "displayUsername"
                    | "userId"
                    | "_id";
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
                  activeOrganizationId?: null | string;
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
                    | "activeOrganizationId"
                    | "_id";
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
                model: "organization";
                update: {
                  createdAt?: number;
                  logo?: null | string;
                  metadata?: null | string;
                  name?: string;
                  slug?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "slug"
                    | "logo"
                    | "createdAt"
                    | "metadata"
                    | "_id";
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
                model: "member";
                update: {
                  createdAt?: number;
                  organizationId?: string;
                  role?: string;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "userId"
                    | "role"
                    | "createdAt"
                    | "_id";
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
                model: "invitation";
                update: {
                  email?: string;
                  expiresAt?: number;
                  inviterId?: string;
                  organizationId?: string;
                  role?: null | string;
                  status?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "organizationId"
                    | "email"
                    | "role"
                    | "status"
                    | "expiresAt"
                    | "inviterId"
                    | "_id";
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
                model: "apikey";
                update: {
                  createdAt?: number;
                  enabled?: null | boolean;
                  expiresAt?: null | number;
                  key?: string;
                  lastRefillAt?: null | number;
                  lastRequest?: null | number;
                  metadata?: null | string;
                  name?: null | string;
                  permissions?: null | string;
                  prefix?: null | string;
                  rateLimitEnabled?: null | boolean;
                  rateLimitMax?: null | number;
                  rateLimitTimeWindow?: null | number;
                  refillAmount?: null | number;
                  refillInterval?: null | number;
                  remaining?: null | number;
                  requestCount?: null | number;
                  start?: null | string;
                  updatedAt?: number;
                  userId?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field:
                    | "name"
                    | "start"
                    | "prefix"
                    | "key"
                    | "userId"
                    | "refillInterval"
                    | "refillAmount"
                    | "lastRefillAt"
                    | "enabled"
                    | "rateLimitEnabled"
                    | "rateLimitTimeWindow"
                    | "rateLimitMax"
                    | "requestCount"
                    | "remaining"
                    | "lastRequest"
                    | "expiresAt"
                    | "createdAt"
                    | "updatedAt"
                    | "permissions"
                    | "metadata"
                    | "_id";
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
                  privateKey?: string;
                  publicKey?: string;
                };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "publicKey" | "privateKey" | "createdAt" | "_id";
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
                model: "rateLimit";
                update: { count?: number; key?: string; lastRequest?: number };
                where?: Array<{
                  connector?: "AND" | "OR";
                  field: "key" | "count" | "lastRequest" | "_id";
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
        any,
        Name
      >;
    };
    auth: {
      getApiKeysByUserId: FunctionReference<
        "query",
        "internal",
        { userId: string },
        Array<{
          _creationTime: number;
          _id: string;
          createdAt: number;
          enabled?: null | boolean;
          expiresAt?: null | number;
          key: string;
          lastRefillAt?: null | number;
          lastRequest?: null | number;
          metadata?: null | string;
          name?: null | string;
          permissions?: null | string;
          prefix?: null | string;
          rateLimitEnabled?: null | boolean;
          rateLimitMax?: null | number;
          rateLimitTimeWindow?: null | number;
          refillAmount?: null | number;
          refillInterval?: null | number;
          remaining?: null | number;
          requestCount?: null | number;
          start?: null | string;
          updatedAt: number;
          userId: string;
        }>,
        Name
      >;
      getUserByEmail: FunctionReference<
        "query",
        "internal",
        { email: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          displayUsername?: null | string;
          email: string;
          emailVerified: boolean;
          image?: null | string;
          isAnonymous?: null | boolean;
          name: string;
          updatedAt: number;
          userId?: null | string;
          username?: null | string;
        },
        Name
      >;
      setUserId: FunctionReference<
        "mutation",
        "internal",
        { authId: string; userId: string },
        any,
        Name
      >;
      updateUserName: FunctionReference<
        "mutation",
        "internal",
        { authId: string; name: string },
        any,
        Name
      >;
      verifyApiKey: FunctionReference<
        "mutation",
        "internal",
        { key: string; permissions?: string },
        {
          error: null | { code: string; message: string };
          userId: null | string;
          valid: boolean;
        },
        Name
      >;
    };
  };

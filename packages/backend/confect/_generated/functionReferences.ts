import { Ref } from "@confect/core";
import type { FunctionReference } from "convex/server";
import refs from "./refs";

type Mutable<T> = T extends string
  ? T
  : T extends number | boolean | bigint | symbol | null | undefined
    ? T
    : T extends (...args: never[]) => unknown
      ? T
      : T extends readonly (infer Item)[]
        ? Mutable<Item>[]
        : T extends object
          ? { -readonly [Key in keyof T]: Mutable<T[Key]> }
          : T;

type FunctionReferenceFor<T extends Ref.Any> = FunctionReference<
  Ref.GetFunctionType<T>,
  Ref.GetFunctionVisibility<T>,
  Mutable<Ref.Args<T>>,
  Mutable<Ref.Returns<T>>
>;

export type FunctionArgs<T> =
  T extends FunctionReference<
    infer _Type,
    infer _Visibility,
    infer Args,
    unknown
  >
    ? Args
    : never;

export type FunctionReturnType<T> =
  T extends FunctionReference<
    infer _Type,
    infer _Visibility,
    infer _Args,
    infer Returns
  >
    ? Returns
    : never;

type FunctionReferences<T> = T extends Ref.Any
  ? FunctionReferenceFor<T>
  : {
      readonly [K in keyof T]: FunctionReferences<T[K]>;
    };

const isRef = (value: unknown): value is Ref.Any =>
  typeof value === "object" &&
  value !== null &&
  "functionSpec" in value &&
  "functionNamespace" in value;

const toFunctionReferences = <T>(value: T): FunctionReferences<T> => {
  if (isRef(value)) {
    return Ref.getFunctionReference(value) as FunctionReferences<T>;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      toFunctionReferences(child),
    ])
  ) as FunctionReferences<T>;
};

export const api = toFunctionReferences(refs.public);
export const internal = toFunctionReferences(refs.internal);

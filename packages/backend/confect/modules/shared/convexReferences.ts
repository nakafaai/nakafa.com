import { Ref } from "@confect/core";
import type { FunctionReference } from "convex/server";

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

export type ConvexFunctionArgs<Ref_ extends Ref.Any> = Mutable<Ref.Args<Ref_>>;

export type ConvexFunctionReference<Ref_ extends Ref.Any> = FunctionReference<
  Ref.GetFunctionType<Ref_>,
  Ref.GetFunctionVisibility<Ref_>,
  ConvexFunctionArgs<Ref_>,
  Mutable<Ref.Returns<Ref_>>
>;

export type ConvexFunctionReturn<Ref_ extends Ref.Any> = Mutable<
  Ref.Returns<Ref_>
>;

/** Converts a Confect ref for native Convex APIs that do not accept Confect refs yet. */
export const toConvexReference = <Ref_ extends Ref.Any>(
  ref: Ref_
): ConvexFunctionReference<Ref_> => Ref.getFunctionReference(ref);

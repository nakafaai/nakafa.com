import type { GenericId } from "@confect/core";
import type { DataModel as ConfectDataModel } from "@confect/server";
import type schema from "../schema";

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

export type DataModel = ConfectDataModel.FromSchema<typeof schema>;

export type TableNames = ConfectDataModel.TableNames<DataModel>;

export type Id<TableName extends string> = GenericId.GenericId<TableName>;

export type Doc<TableName extends TableNames> = Mutable<
  ConfectDataModel.DocumentByName<DataModel, TableName>
>;

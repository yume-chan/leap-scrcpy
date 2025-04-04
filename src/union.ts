import {
  Field,
  FieldByobSerializeContext,
  StructLike,
  StructValue,
  field,
} from "@yume-chan/struct";

export type UnionFieldValue<
  TagKey extends string,
  TagType extends string | number,
  T extends Record<TagType, StructLike<unknown>>,
> = {
  [K in keyof T]: Record<TagKey, K> & StructValue<T[K]>;
}[keyof T];

export interface DiscriminatedUnionFactory {
  <
    TagKey extends string,
    TagType extends string | number,
    Types extends Record<TagType, StructLike<unknown>>,
  >(
    tagKey: TagKey,
    types: Types,
  ): Field<
    UnionFieldValue<TagKey, TagType, Types>,
    TagKey,
    Record<TagKey, TagType>
  >;

  <
    TagKey extends string,
    TagType extends string | number,
    TagField extends Field<TagType, string, unknown>,
    Types extends Record<TagType, StructLike<unknown>>,
  >(
    tag: Record<TagKey, TagField>,
    types: Types,
  ): Field<
    UnionFieldValue<TagKey, TagType, Types>,
    Exclude<TagField["omitInit"], undefined>,
    unknown
  >;
}

export const union: DiscriminatedUnionFactory = (<
  TagKey extends string,
  TagType extends string | number,
  Types extends Record<TagType, StructLike<unknown>>,
>(
  tagKeyOrField: TagKey | Record<TagKey, Field<TagType, never, unknown>>,
  types: Types,
) => {
  if (typeof tagKeyOrField === "string") {
    return field<
      UnionFieldValue<TagKey, TagType, Types>,
      TagKey,
      Record<TagKey, TagType>,
      Uint8Array
    >(
      0,
      "default",
      (source) => source,
      function* (then, reader, context) {
        const tag = context.dependencies[tagKeyOrField];

        const type = types[tag];
        const value = yield* then(type.deserialize(reader));

        Object.assign(value as object, { [tagKeyOrField]: tag })
        return value as never
      },
      {
        init(value, dependencies) {
          const tag = value[tagKeyOrField];
          dependencies[tagKeyOrField] = tag as TagType;
          const type = types[tag];
          return type.serialize(value);
        },
      }
    );
  }

  const [tagName, tagField] = Object.entries(tagKeyOrField)[0] as [
    TagKey,
    Field<TagType, never, unknown, TagType>,
  ];
  return field<
    UnionFieldValue<TagKey, TagType, Types>,
    TagKey,
    Record<TagKey, TagType>
  >(
    tagField.size,
    "default",
    (source, context) => {
      const tag = source[tagName] as TagType;
      const type = types[tag];

      if (tagField.type === "byob" && type.type === "byob") {
        const buffer = new Uint8Array(tagField.size + type.size);

        const newContext = {
          littleEndian: context.littleEndian,
          buffer,
          index: 0,
        } satisfies FieldByobSerializeContext;
        tagField.serialize(tag, newContext);

        newContext.index = tagField.size;
        type.serialize(source as never, newContext);

        return buffer;
      }

      const tagBuffer = tagField.serialize(tag, context);
      const typeBuffer = type.serialize(source as never);

      const buffer = new Uint8Array(tagBuffer.length + typeBuffer.length);
      buffer.set(tagBuffer, 0);
      buffer.set(typeBuffer, tagBuffer.length);
      return buffer;
    },
    function* (then, reader, context) {
      const tag = yield* then(tagField.deserialize(reader, context));

      const type = types[tag as TagType];
      const value = yield* then(type.deserialize(reader));

      Object.assign(value as object, { [tagName]: tag });
      return value as never;
    },
  );
}) as never;

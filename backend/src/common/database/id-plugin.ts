import { Schema } from 'mongoose';

export type JsonMapper = (value: Record<string, unknown>) => void;

export function applyIdPlugin(schema: Schema, idField: string, mapper?: JsonMapper): void {
  schema.set('toJSON', {
    transform: (_document: unknown, value: Record<string, unknown>) => {
      if (value._id !== undefined) {
        value._id = String(value._id);
        value[idField] ??= value._id;
      }
      delete value.__v;

      for (const [path, definition] of Object.entries(schema.paths)) {
        if (definition.options.select === false) delete value[path];
      }

      mapper?.(value);
      return value;
    },
  });
}

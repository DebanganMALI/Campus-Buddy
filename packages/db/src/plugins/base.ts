import { Schema } from "mongoose";

export function basePlugin(schema: Schema) {
  // Ensure every model has a deletedAt field defaulting to null
  schema.add({ deletedAt: { type: Date, default: null } });

  // Clean up the data when it is converted to JSON for the frontend
  schema.set("toJSON", {
    transform: (doc, ret) => {
      // Expose 'id' instead of '_id' and remove the version key '__v'
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      
      // Automatically remove any sensitive fields marked with select: false
      for (const path in schema.paths) {
        if (schema.paths[path].options && schema.paths[path].options.select === false) {
          delete ret[path];
        }
      }
      return ret;
    }
  });
}

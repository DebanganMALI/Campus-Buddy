import { Schema } from "mongoose";
import { DEPARTMENTS, YEARS } from "@scc/shared";

// Reused by announcements and events. "ALL" is a wildcard for every department
// or every year. Stored as given; the flattened `audienceKeys` (derived in each
// model's pre-validate hook) is what queries actually filter on.
export const audienceSchema = new Schema(
  {
    departments: {
      type: [String],
      enum: [...DEPARTMENTS, "ALL"],
      required: true,
      validate: (v: string[]) => v.length >= 1 && v.length <= 30,
    },
    years: {
      type: [Schema.Types.Mixed],
      required: true,
      validate: (v: unknown[]) =>
        v.length >= 1 && v.every((y) => y === "ALL" || (YEARS as readonly number[]).includes(y as number)),
    },
  },
  { _id: false },
);

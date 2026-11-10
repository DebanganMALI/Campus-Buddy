import type { Model, SortOrder } from "mongoose";

// Keyset (cursor) pagination: stable and index-friendly, no skip().
// The cursor encodes the last item's sort value + id, so the next page starts
// exactly after it even when sort values tie.

interface PaginateOpts {
  sortField: string;
  direction: 1 | -1;
  limit: number;
  cursor?: string | null;
}

interface Cursor {
  v: unknown;
  id: string;
}

const encodeCursor = (c: Cursor): string => Buffer.from(JSON.stringify(c)).toString("base64url");

const decodeCursor = (s: string): Cursor => {
  const parsed: unknown = JSON.parse(Buffer.from(s, "base64url").toString("utf8"));
  if (!parsed || typeof parsed !== "object" || !("id" in parsed) || !("v" in parsed)) {
    throw new Error("Invalid cursor");
  }
  return parsed as Cursor;
};

export async function paginate<T>(
  model: Model<T>,
  filter: Record<string, unknown>,
  opts: PaginateOpts,
): Promise<{ items: T[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(opts.limit, 1), 50);
  const q: Record<string, unknown> = { ...filter };

  if (opts.cursor) {
    const { v, id } = decodeCursor(opts.cursor);
    const op = opts.direction === -1 ? "$lt" : "$gt";
    const keyset = [{ [opts.sortField]: { [op]: v } }, { [opts.sortField]: v, _id: { [op]: id } }];
    const existingAnd = Array.isArray(q.$and) ? (q.$and as unknown[]) : [];
    q.$and = [...existingAnd, { $or: keyset }];
  }

  const sort: Record<string, SortOrder> = { [opts.sortField]: opts.direction, _id: opts.direction };
  // The filter is built from typed helpers above; cast once at the Mongoose boundary.
  // Our filter is assembled from typed helpers above; assert to the exact type
  // Mongoose's find() expects (its filter-query type isn't cleanly importable here).
  const docs = await model
    .find(q as unknown as Parameters<Model<T>["find"]>[0])
    .sort(sort)
    .limit(limit + 1)
    .lean<T[]>();

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const last = items.at(-1) as (Record<string, unknown> & { _id: unknown }) | undefined;
  const nextCursor =
    hasMore && last ? encodeCursor({ v: last[opts.sortField], id: String(last._id) }) : null;

  return { items, nextCursor };
}

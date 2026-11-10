import mongoose, { type ClientSession } from "mongoose";

// Runs `fn` inside a MongoDB transaction, retrying transient errors as Mongo
// advises. Needs a replica set (local docker rs0, or Atlas). Used for the
// atomic RSVP/waitlist logic so an event can never overbook under concurrency.
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "../api/errors";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Never retry 4xx errors: retrying a "forbidden" or "not found" can't succeed
      retry: (count, err) => !(isApiError(err) && err.status >= 400 && err.status < 500) && count < 2,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});

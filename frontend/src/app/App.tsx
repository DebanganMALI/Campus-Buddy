import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router/dom";
import { AuthProvider } from "../auth/AuthProvider";
import { ToastProvider } from "../components/ToastProvider";
import { queryClient } from "./query-client";
import { router } from "./router";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

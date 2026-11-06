import { createBrowserRouter, Navigate } from "react-router";
import { GuestOnly, RequireAuth } from "../auth/guards";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  {
    path: "/login",
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    path: "/dashboard",
    element: (
      <RequireAuth>
        <DashboardPage />
      </RequireAuth>
    ),
  },
  { path: "*", element: <NotFoundPage /> },
]);

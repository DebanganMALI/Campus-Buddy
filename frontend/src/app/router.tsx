import { createBrowserRouter, Navigate } from "react-router";
import { GuestOnly, RequireAuth, RequirePermission } from "../auth/guards";
import { AppShell } from "../layouts/AppShell";
import { AdminUsersPage } from "../pages/AdminUsersPage";
import { AnnouncementDetailPage } from "../pages/AnnouncementDetailPage";
import { AnnouncementFormPage } from "../pages/AnnouncementFormPage";
import { AnnouncementsPage } from "../pages/AnnouncementsPage";
import { BookmarksPage } from "../pages/BookmarksPage";
import { DashboardPage } from "../pages/DashboardPage";
import { EventDetailPage } from "../pages/EventDetailPage";
import { EventFormPage } from "../pages/EventFormPage";
import { EventsPage } from "../pages/EventsPage";
import { LeavingPage } from "../pages/LeavingPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { OpeningDetailPage } from "../pages/OpeningDetailPage";
import { OpeningsPage } from "../pages/OpeningsPage";
import { ProfilePage } from "../pages/ProfilePage";
import { RegisterPage } from "../pages/RegisterPage";
import { ResourcesPage } from "../pages/ResourcesPage";
import { ResourceUploadPage } from "../pages/ResourceUploadPage";
import { SearchPage } from "../pages/SearchPage";

// Permission guards hide pages from the wrong role (UI only). The API refuses the call anyway.
export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/dashboard" replace /> },
  { path: "/login", element: <GuestOnly><LoginPage /></GuestOnly> },
  { path: "/register", element: <GuestOnly><RegisterPage /></GuestOnly> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/announcements", element: <AnnouncementsPage /> },
      { path: "/announcements/new", element: <RequirePermission anyOf={["announcement:create"]}><AnnouncementFormPage /></RequirePermission> },
      { path: "/announcements/:id", element: <AnnouncementDetailPage /> },
      { path: "/announcements/:id/edit", element: <RequirePermission anyOf={["announcement:update:own", "announcement:update:any"]}><AnnouncementFormPage /></RequirePermission> },
      { path: "/events", element: <EventsPage /> },
      { path: "/events/new", element: <RequirePermission anyOf={["event:create"]}><EventFormPage /></RequirePermission> },
      { path: "/events/:id", element: <EventDetailPage /> },
      { path: "/events/:id/edit", element: <RequirePermission anyOf={["event:update:own", "event:update:any"]}><EventFormPage /></RequirePermission> },
      { path: "/resources", element: <ResourcesPage /> },
      { path: "/resources/upload", element: <RequirePermission anyOf={["resource:create", "resource:submit"]}><ResourceUploadPage /></RequirePermission> },
      { path: "/openings", element: <OpeningsPage /> },
      { path: "/openings/:id", element: <OpeningDetailPage /> },
      { path: "/leaving/:openingId", element: <LeavingPage /> },
      { path: "/search", element: <SearchPage /> },
      { path: "/bookmarks", element: <BookmarksPage /> },
      { path: "/me", element: <ProfilePage /> },
      { path: "/admin/users", element: <RequirePermission anyOf={["user:read"]}><AdminUsersPage /></RequirePermission> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

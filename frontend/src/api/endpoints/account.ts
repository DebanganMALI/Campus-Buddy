// Search, bookmarks, profile and admin endpoints (AGENTS.md §5.8).
import type { UserDTO } from "@scc/shared";
import { api } from "../client";
import { qs } from "../query";
import type { BookmarkItem, ContentType, Page, ProfileDTO, SearchResults } from "../types";

export const search = (q: string, signal?: AbortSignal, limit = 6) =>
  api<SearchResults>("GET", `/search${qs({ q, types: "announcement,event,resource,opening", limit })}`, { signal });

export const listBookmarks = (type: ContentType | "", signal?: AbortSignal) =>
  api<Page<BookmarkItem>>("GET", `/bookmarks${qs({ type })}`, { signal });
export const addBookmark = (itemType: ContentType, itemId: string) =>
  api<unknown>("POST", "/bookmarks", { body: { itemType, itemId } });
export const removeBookmark = (itemType: ContentType, itemId: string) =>
  api<void>("DELETE", `/bookmarks/${itemType}/${encodeURIComponent(itemId)}`);

export const getProfile = (signal?: AbortSignal) => api<ProfileDTO>("GET", "/profile", { signal });
export const updateProfile = (body: { name?: string; phone?: string; bio?: string }) =>
  api<ProfileDTO>("PATCH", "/profile", { body });

export interface UserFilters {
  q?: string;
  role?: string;
  status?: string;
  department?: string;
  cursor?: string | null;
}
export const listUsers = (f: UserFilters, signal?: AbortSignal) =>
  api<Page<UserDTO>>("GET", `/admin/users${qs({ ...f })}`, { signal });
export const setUserStatus = (id: string, status: "active" | "suspended", reason: string) =>
  api<UserDTO>("PATCH", `/admin/users/${encodeURIComponent(id)}/status`, { body: { status, reason } });

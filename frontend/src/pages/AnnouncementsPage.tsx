import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { listAnnouncements } from "../api/endpoints/content";
import { keys } from "../api/keys";
import { useAuth } from "../auth/auth-context";
import { AnnouncementRow } from "../components/cards";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, LoadingCards } from "../components/ui";
import { PageBand } from "../components/PageBand";
import { useDebounced } from "../lib/use-debounced";
import { useDocumentTitle } from "../lib/use-document-title";

export function AnnouncementsPage() {
  useDocumentTitle("Announcements");
  const { can } = useAuth();
  // Filters live in the URL so they survive reloads and can be shared
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const pinnedOnly = params.get("pinned") === "true";
  const sort = params.get("sort") === "oldest" ? "oldest" : "newest";
  const debouncedQ = useDebounced(q.trim(), 300);

  const filters = { q: debouncedQ || undefined, pinned: pinnedOnly || undefined };
  const query = useInfiniteQuery({
    queryKey: [...keys.announcements, "list", filters],
    queryFn: ({ pageParam, signal }) => listAnnouncements({ ...filters, cursor: pageParam, limit: 12 }, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  let items = query.data?.pages.flatMap((p) => p.items) ?? [];
  if (sort === "oldest") items = [...items].reverse();

  return (
    <div className="page">
      <PageBand kind="news"
        title="Announcements"
        lead="Official updates for your department and year, newest first."
        actions={
          can("announcement:create") && (
            <Link to="/announcements/new" className="btn btn-primary">
              <Icon name="plus" size={18} /> New announcement
            </Link>
          )
        }
      />
      <div className="container">

      <div className="filters">
        <div className="input-wrap">
          <Icon name="search" className="lead-icon" />
          <label htmlFor="ann-q" className="sr-only">
            Search announcements
          </label>
          <input
            id="ann-q"
            className="input has-icon"
            type="search"
            placeholder="Search announcements"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              update("q", e.target.value.trim() || null);
            }}
          />
        </div>
        <div className="pill-group" role="group" aria-label="Filter and sort">
          <button type="button" className="pill" aria-pressed={!pinnedOnly} onClick={() => update("pinned", null)}>
            All
          </button>
          <button type="button" className="pill" aria-pressed={pinnedOnly} onClick={() => update("pinned", "true")}>
            Pinned
          </button>
          <button
            type="button"
            className="pill"
            aria-pressed={sort === "oldest"}
            onClick={() => update("sort", sort === "oldest" ? null : "oldest")}
          >
            {sort === "oldest" ? "Oldest first" : "Newest first"}
          </button>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {query.isSuccess ? `${items.length} announcements shown` : ""}
      </p>

      {query.isPending ? (
        <LoadingCards count={6} label="Loading announcements" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="megaphone"
          title={debouncedQ || pinnedOnly ? "No matches" : "No announcements yet"}
          body={debouncedQ ? `Nothing matches “${debouncedQ}”. Try a different word.` : "New announcements for you will appear here."}
        />
      ) : (
        <>
          <div className="feed">
            {items.map((a) => (
              <AnnouncementRow key={a.id} a={a} />
            ))}
          </div>
          {query.hasNextPage && (
            <div className="load-more">
              <button type="button" className="btn" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  );
}

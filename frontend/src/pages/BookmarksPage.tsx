import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { listBookmarks } from "../api/endpoints/account";
import { keys } from "../api/keys";
import type { ContentType } from "../api/types";
import { AnnouncementCard, EventCard, OpeningCard, ResourceRow } from "../components/cards";
import { EmptyState, ErrorState, LoadingCards, PageHeader } from "../components/ui";
import { useDocumentTitle } from "../lib/use-document-title";

const TABS: Array<{ v: ContentType | ""; label: string }> = [
  { v: "", label: "All" },
  { v: "announcement", label: "Announcements" },
  { v: "event", label: "Events" },
  { v: "resource", label: "Resources" },
  { v: "opening", label: "Opportunities" },
];

export function BookmarksPage() {
  useDocumentTitle("Bookmarks");
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") ?? "") as ContentType | "";
  const query = useQuery({ queryKey: [...keys.bookmarks, type], queryFn: ({ signal }) => listBookmarks(type, signal) });
  const items = query.data?.items ?? [];

  return (
    <div className="page container">
      <PageHeader title="Bookmarks" lead="Everything you saved for later. Only you can see this list." />
      <div className="pill-group" role="tablist" aria-label="Bookmark type" style={{ marginBottom: "var(--space-6)" }}>
        {TABS.map((t) => (
          <button key={t.v} type="button" role="tab" className="pill" aria-selected={type === t.v} onClick={() => setParams(t.v ? { type: t.v } : {}, { replace: true })}>
            {t.label}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <LoadingCards count={3} label="Loading bookmarks" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Nothing saved yet"
          body="Tap the bookmark icon on any announcement, event, resource or opportunity to keep it here."
          action={<Link to="/resources" className="btn">Browse resources</Link>}
        />
      ) : (
        <div className="stack">
          {items.map((b) => {
            switch (b.itemType) {
              case "announcement": return <AnnouncementCard key={b.itemId} a={b.item} />;
              case "event": return <EventCard key={b.itemId} e={b.item} />;
              case "opening": return <OpeningCard key={b.itemId} o={b.item} />;
              case "resource": return <div key={b.itemId} className="list"><ResourceRow r={b.item} /></div>;
            }
          })}
        </div>
      )}
    </div>
  );
}

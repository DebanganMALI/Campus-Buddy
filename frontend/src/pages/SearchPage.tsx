import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { search } from "../api/endpoints/account";
import { keys } from "../api/keys";
import { AnnouncementCard, EventCard, OpeningCard, ResourceRow } from "../components/cards";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, LoadingCards, PageHeader } from "../components/ui";
import { useDebounced } from "../lib/use-debounced";
import { useDocumentTitle } from "../lib/use-document-title";

export function SearchPage() {
  useDocumentTitle("Search");
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const term = useDebounced(q.trim(), 300);

  // One request, four content types, already filtered to what this user may see
  const query = useQuery({
    queryKey: [...keys.search, term],
    queryFn: ({ signal }) => search(term, signal),
    enabled: term.length >= 2,
  });

  const r = query.data;
  const total = r ? r.announcements.length + r.events.length + r.resources.length + r.openings.length : 0;

  return (
    <div className="page container">
      <PageHeader title="Search" lead="Announcements, events, resources and opportunities in one place." />
      <form
        role="search"
        className="input-wrap"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Icon name="search" className="lead-icon" />
        <label htmlFor="global-q" className="sr-only">Search everything</label>
        <input
          id="global-q"
          className="input has-icon"
          style={{ minHeight: 56, fontSize: "1.0625rem" }}
          type="search"
          autoFocus
          placeholder="Try “operating systems”, “internship” or “sports”"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setParams(e.target.value.trim() ? { q: e.target.value.trim() } : {}, { replace: true });
          }}
        />
      </form>

      <p className="sr-only" aria-live="polite">{r ? `${total} results` : ""}</p>

      <div className="section" style={{ marginTop: "var(--space-8)" }}>
        {term.length < 2 ? (
          <EmptyState icon="search" title="Start typing to search" body="Type at least 2 characters." />
        ) : query.isPending ? (
          <LoadingCards count={3} label="Searching" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : total === 0 ? (
          <EmptyState icon="search" title={`No results for “${term}”`} body="Check the spelling or try a broader word." />
        ) : (
          <div className="stack" style={{ gap: "var(--space-12)" }}>
            {r!.announcements.length > 0 && (
              <section aria-labelledby="sr-a">
                <div className="section-head"><h2 id="sr-a">Announcements <span className="muted small">({r!.announcements.length})</span></h2></div>
                <div className="grid grid-3">{r!.announcements.map((a) => <AnnouncementCard key={a.id} a={a} />)}</div>
              </section>
            )}
            {r!.events.length > 0 && (
              <section aria-labelledby="sr-e">
                <div className="section-head"><h2 id="sr-e">Events <span className="muted small">({r!.events.length})</span></h2></div>
                <div className="grid grid-3">{r!.events.map((e) => <EventCard key={e.id} e={e} />)}</div>
              </section>
            )}
            {r!.resources.length > 0 && (
              <section aria-labelledby="sr-r">
                <div className="section-head"><h2 id="sr-r">Resources <span className="muted small">({r!.resources.length})</span></h2></div>
                <div className="list">{r!.resources.map((x) => <ResourceRow key={x.id} r={x} />)}</div>
              </section>
            )}
            {r!.openings.length > 0 && (
              <section aria-labelledby="sr-o">
                <div className="section-head"><h2 id="sr-o">Opportunities <span className="muted small">({r!.openings.length})</span></h2></div>
                <div className="grid grid-3">{r!.openings.map((o) => <OpeningCard key={o.id} o={o} />)}</div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

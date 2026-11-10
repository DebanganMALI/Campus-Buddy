import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { listEvents } from "../api/endpoints/content";
import { keys } from "../api/keys";
import { useAuth } from "../auth/auth-context";
import { EventCard } from "../components/cards";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, LoadingCards } from "../components/ui";
import { PageBand } from "../components/PageBand";
import { useDebounced } from "../lib/use-debounced";
import { useDocumentTitle } from "../lib/use-document-title";

export function EventsPage() {
  useDocumentTitle("Events");
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const when = params.get("when") === "past" ? "past" : "upcoming";
  const [q, setQ] = useState(params.get("q") ?? "");
  const debouncedQ = useDebounced(q.trim(), 300);

  const query = useQuery({
    queryKey: [...keys.events, "list", { q: debouncedQ }],
    queryFn: ({ signal }) => listEvents({ q: debouncedQ || undefined, limit: 50 }, signal),
  });

  // The contract has no upcoming/past filter, so we split the list here by end time
  const now = Date.now();
  const all = query.data?.items ?? [];
  const items =
    when === "upcoming"
      ? all.filter((e) => Date.parse(e.endsAt) >= now)
      : all.filter((e) => Date.parse(e.endsAt) < now).reverse();

  const setWhen = (w: "upcoming" | "past") => {
    const next = new URLSearchParams(params);
    if (w === "past") next.set("when", "past");
    else next.delete("when");
    setParams(next, { replace: true });
  };

  return (
    <div className="page">
      <PageBand kind="events"
        title="Events"
        lead="Talks, workshops and campus activities open to you."
        actions={
          can("event:create") && (
            <Link to="/events/new" className="btn btn-primary">
              <Icon name="plus" size={18} /> New event
            </Link>
          )
        }
      />
      <div className="container">
      <div className="filters">
        <div className="input-wrap">
          <Icon name="search" className="lead-icon" />
          <label htmlFor="evt-q" className="sr-only">Search events</label>
          <input id="evt-q" className="input has-icon" type="search" placeholder="Search events or venues" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="pill-group" role="tablist" aria-label="When">
          <button type="button" role="tab" className="pill" aria-selected={when === "upcoming"} onClick={() => setWhen("upcoming")}>
            Upcoming
          </button>
          <button type="button" role="tab" className="pill" aria-selected={when === "past"} onClick={() => setWhen("past")}>
            Past
          </button>
        </div>
      </div>

      {query.isPending ? (
        <LoadingCards count={4} label="Loading events" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="calendar"
          title={debouncedQ ? "No matches" : when === "upcoming" ? "No upcoming events" : "No past events"}
          body={debouncedQ ? `Nothing matches “${debouncedQ}”.` : "Check back soon."}
        />
      ) : (
        <div className="grid grid-3">
          {items.map((e) => (
            <EventCard key={e.id} e={e} />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

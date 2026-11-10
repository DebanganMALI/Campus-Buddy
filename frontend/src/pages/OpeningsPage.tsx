import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router";
import { listOpenings } from "../api/endpoints/content";
import { keys } from "../api/keys";
import { OpeningCard } from "../components/cards";
import { Icon } from "../components/Icon";
import { EmptyState, ErrorState, LoadingCards } from "../components/ui";
import { PageBand } from "../components/PageBand";
import { useDebounced } from "../lib/use-debounced";
import { useDocumentTitle } from "../lib/use-document-title";

const TYPES = [
  { v: "", label: "All" },
  { v: "internship", label: "Internships" },
  { v: "job", label: "Jobs" },
] as const;

export function OpeningsPage() {
  useDocumentTitle("Opportunities");
  const [params, setParams] = useSearchParams();
  const type = (params.get("type") ?? "") as "" | "job" | "internship";
  const soon = params.get("soon") === "1";
  const [q, setQ] = useState(params.get("q") ?? "");
  const debouncedQ = useDebounced(q.trim(), 300);

  const filters = { type: type || undefined, closingWithinDays: soon ? 7 : undefined, q: debouncedQ || undefined };
  const query = useQuery({
    queryKey: [...keys.openings, "list", filters],
    queryFn: ({ signal }) => listOpenings({ ...filters, limit: 50 }, signal),
  });

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const items = query.data?.items ?? [];

  return (
    <div className="page">
      <PageBand kind="openings"
        title="Opportunities"
        lead="Internships and jobs you're eligible for, sorted by closing date. Applications happen on the company's site."
      />
      <div className="container">
      <div className="filters">
        <div className="input-wrap">
          <Icon name="search" className="lead-icon" />
          <label htmlFor="op-q" className="sr-only">Search opportunities</label>
          <input id="op-q" className="input has-icon" type="search" placeholder="Search by role or company" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="pill-group" role="group" aria-label="Filter opportunities">
          {TYPES.map((t) => (
            <button key={t.v} type="button" className="pill" aria-pressed={type === t.v} onClick={() => update("type", t.v)}>
              {t.label}
            </button>
          ))}
          <button type="button" className="pill" aria-pressed={soon} onClick={() => update("soon", soon ? "" : "1")}>
            Closing this week
          </button>
        </div>
      </div>
      {query.isPending ? (
        <LoadingCards count={6} label="Loading opportunities" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="briefcase" title="No open opportunities match" body="Try removing a filter, or check back later." />
      ) : (
        <div className="grid grid-3">
          {items.map((o) => <OpeningCard key={o.id} o={o} />)}
        </div>
      )}
      </div>
    </div>
  );
}

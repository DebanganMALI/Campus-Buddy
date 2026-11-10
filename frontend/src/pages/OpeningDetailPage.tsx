import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { getOpening } from "../api/endpoints/content";
import { isApiError } from "../api/errors";
import { keys } from "../api/keys";
import { BookmarkButton } from "../components/BookmarkButton";
import { Icon } from "../components/Icon";
import { DeadlineChip, ErrorState, NotFoundInline } from "../components/ui";
import { audienceLabel, formatDateTime } from "../lib/format";
import { useDocumentTitle } from "../lib/use-document-title";

export function OpeningDetailPage() {
  const { id = "" } = useParams();
  const query = useQuery({ queryKey: [...keys.openings, "detail", id], queryFn: ({ signal }) => getOpening(id, signal) });
  const o = query.data;
  useDocumentTitle(o ? `${o.title} · ${o.company}` : "Opportunity");

  if (query.isPending) return <div className="container page"><div className="skeleton" style={{ height: 320, marginTop: 40 }} /></div>;
  if (query.isError) {
    if (isApiError(query.error) && query.error.code === "NOT_FOUND") return <NotFoundInline what="opportunity" backTo="/openings" backLabel="All opportunities" />;
    return <div className="container section"><ErrorState error={query.error} onRetry={() => void query.refetch()} /></div>;
  }
  if (!o) return null;
  const closed = Date.parse(o.closesAt) <= Date.now();

  return (
    <div className="page container">
      <nav className="crumbs section" aria-label="Breadcrumb">
        <Link to="/openings">Opportunities</Link>
        <Icon name="arrowRight" size={14} />
        <span aria-current="page">{o.company}</span>
      </nav>
      <div className="split" style={{ marginTop: "var(--space-6)" }}>
        <article className="article stack">
          <div className="chip-row">
            <span className="chip chip-mint">{o.type === "job" ? "Job" : "Internship"}</span>
            <DeadlineChip closesAt={o.closesAt} />
          </div>
          <p className="eyebrow">{o.company}</p>
          <h1 id="page-title" tabIndex={-1}>{o.title}</h1>
          <div className="article-body">{o.description}</div>
        </article>
        <aside className="card aside-card stack">
          <dl className="meta-list">
            <div><dt>Closes</dt><dd>{formatDateTime(o.closesAt)}</dd></div>
            {o.location && <div><dt>Location</dt><dd>{o.location}</dd></div>}
            {o.compensation && <div><dt>Pay</dt><dd>{o.compensation}</dd></div>}
            <div><dt>Eligible</dt><dd>{audienceLabel({ departments: o.eligibility.departments, years: o.eligibility.years })}</dd></div>
            {o.eligibility.minCgpa != null && <div><dt>Minimum CGPA</dt><dd>{o.eligibility.minCgpa}</dd></div>}
            <div><dt>Posted by</dt><dd>{o.postedBy.name}</dd></div>
          </dl>
          {closed ? (
            <p className="form-error">Applications have closed.</p>
          ) : (
            // Never link straight out: the interstitial shows the destination domain first
            <Link to={`/leaving/${o.id}`} className="btn btn-primary btn-block">
              Apply on company site <Icon name="external" size={16} />
            </Link>
          )}
          <div className="row">
            <BookmarkButton type="opening" id={o.id} initial={o.bookmarked} title={o.title} />
            <span className="small muted">Save for later</span>
          </div>
        </aside>
      </div>
    </div>
  );
}

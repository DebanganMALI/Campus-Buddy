import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { getOpening } from "../api/endpoints/content";
import { keys } from "../api/keys";
import { Icon } from "../components/Icon";
import { ErrorState } from "../components/ui";
import { useDocumentTitle } from "../lib/use-document-title";

/**
 * External-link confirmation. The URL is loaded from the opening by id, never taken
 * from the query string, so nobody can craft a link that bounces users to a bad site.
 */
export function LeavingPage() {
  useDocumentTitle("Leaving Campus Companion");
  const { openingId = "" } = useParams();
  const query = useQuery({ queryKey: [...keys.openings, "detail", openingId], queryFn: ({ signal }) => getOpening(openingId, signal) });

  if (query.isPending) return <div className="container page"><div className="skeleton" style={{ height: 240, marginTop: 64 }} /></div>;
  if (query.isError) return <div className="container section"><ErrorState error={query.error} onRetry={() => void query.refetch()} /></div>;

  let url: URL | null = null;
  try {
    url = new URL(query.data.applyUrl);
  } catch {
    url = null;
  }
  const safe = url !== null && url.protocol === "https:";

  return (
    <div className="page container">
      <div className="leaving">
        <span className="state-icon"><Icon name="external" size={28} /></span>
        <h1 id="page-title" tabIndex={-1}>You're leaving Campus Companion</h1>
        <p className="muted">
          The application for <strong>{query.data.title}</strong> at {query.data.company} is on an external site:
        </p>
        {safe ? <p className="domain">{url!.hostname}</p> : <p className="form-error">This link isn't a secure (https) address, so we won't open it.</p>}
        <p className="small muted">Check the address before entering any personal details. Never share your college password.</p>
        <div className="row">
          <Link to={`/openings/${openingId}`} className="btn">Go back</Link>
          {safe && (
            <a href={url!.href} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary">
              Continue to {url!.hostname} <Icon name="external" size={16} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

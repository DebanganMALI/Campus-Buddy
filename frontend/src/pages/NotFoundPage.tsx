import { Link } from "react-router";
import { useDocumentTitle } from "../lib/use-document-title";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <main className="state-center" id="main">
      <div className="state-card">
        <p className="state-code">404</p>
        <h1 className="serif" id="page-title" tabIndex={-1}>This page took a study break</h1>
        <p className="muted">The link may be old, or the page has moved.</p>
        <Link className="btn btn-primary" to="/dashboard">Go to dashboard</Link>
      </div>
    </main>
  );
}

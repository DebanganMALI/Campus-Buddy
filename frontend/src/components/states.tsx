// Temporary state screens. Tanisha's design pass replaces the look; the behaviour stays.
import { Link } from "react-router";

export function FullScreenLoading() {
  return (
    <div className="center-screen" role="status" aria-live="polite">
      <p className="eyebrow">Loading…</p>
    </div>
  );
}

export function ServerErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1>We can't reach the server</h1>
        <p className="muted">{message}</p>
        <p className="muted small">If the app was asleep, the first load can take up to a minute.</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </main>
  );
}

export function ForbiddenState() {
  return (
    <main className="center-screen">
      <div className="card narrow">
        <h1>You don't have access to this</h1>
        <p className="muted">If you think that's wrong, contact an admin.</p>
        <Link className="btn" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}

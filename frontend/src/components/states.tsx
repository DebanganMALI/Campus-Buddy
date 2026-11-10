// Full-page states used by the route guards. Behaviour unchanged from part 1; new look.
import { Link } from "react-router";
import { Icon } from "./Icon";

export function FullScreenLoading() {
  return (
    <div className="boot" role="status" aria-live="polite">
      <span className="brand-mark" aria-hidden>
        C
      </span>
      <span className="sr-only">Loading Campus Companion…</span>
    </div>
  );
}

export function ServerErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="state-center">
      <div className="state-card">
        <span className="state-icon danger">
          <Icon name="alert" size={28} />
        </span>
        <h1 className="serif">We can't reach the server</h1>
        <p className="muted">{message}</p>
        <p className="small muted">If the app was asleep, the first load can take up to a minute.</p>
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
      </div>
    </main>
  );
}

export function ForbiddenState() {
  return (
    <div className="state-center">
      <div className="state-card">
        <span className="state-icon">
          <Icon name="lock" size={28} />
        </span>
        <h1 className="serif" id="page-title" tabIndex={-1}>
          You don't have access to this
        </h1>
        <p className="muted">If you think that's wrong, contact an admin.</p>
        <Link className="btn" to="/dashboard">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="center-screen">
      <div className="card narrow">
        <p className="eyebrow">404</p>
        <h1>This page took a study break</h1>
        <Link className="btn" to="/dashboard">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}

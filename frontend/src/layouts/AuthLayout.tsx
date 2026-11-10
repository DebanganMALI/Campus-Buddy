import type { ReactNode } from "react";
import { Aurora } from "../components/PageBand";
import { Icon } from "../components/Icon";

/**
 * Split screen: a preview of the product floating over the night panel, the form on paper.
 * The preview cards are illustrative (they describe features), not real campus records.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <section className="auth-art" aria-label="About Campus Companion">
        <Aurora />
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            C
          </span>
          <span className="brand-name">Campus Companion</span>
        </div>
        <div className="stack">
          <p className="auth-headline">
            Your campus,
            <br />
            in one place.
          </p>
          <ul className="auth-points">
            <li>
              <Icon name="megaphone" /> Announcements for your department and year
            </li>
            <li>
              <Icon name="book" /> Notes and slides, sorted by semester and subject
            </li>
            <li>
              <Icon name="briefcase" /> Internships and jobs, with clear deadlines
            </li>
          </ul>
        </div>
        <div className="preview" aria-hidden>
          <div className="pcard p1">
            <span className="pill-tag" style={{ background: "var(--cat-news)" }}>Announcement</span>
            <b>Posts for your department and year</b>
            <small>Pinned updates stay on top</small>
          </div>
          <div className="pcard p2">
            <span className="pill-tag" style={{ background: "var(--cat-events)" }}>Event</span>
            <b>See what's on this week</b>
            <small>Date, time and venue at a glance</small>
          </div>
          <div className="pcard p3">
            <span className="pill-tag" style={{ background: "var(--cat-openings)" }}>Opportunity</span>
            <b>Know how many days are left</b>
          </div>
        </div>
        <p className="small">A SEPM project at IEM Kolkata</p>
      </section>
      <main className="auth-form-side" id="main">
        {children}
      </main>
    </div>
  );
}

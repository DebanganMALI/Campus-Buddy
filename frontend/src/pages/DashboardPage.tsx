import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { Link } from "react-router";
import { listAnnouncements, listEvents, listOpenings } from "../api/endpoints/content";
import { keys } from "../api/keys";
import { useAuth } from "../auth/auth-context";
import { AnnouncementRow } from "../components/cards";
import { CategoryArt, type Category } from "../components/Art";
import { Icon, type IconName } from "../components/Icon";
import { Aurora } from "../components/PageBand";
import { EmptyState, ErrorState } from "../components/ui";
import { daysUntil, forAudience, formatTime, greeting, relativeDay } from "../lib/format";
import { useDocumentTitle } from "../lib/use-document-title";

const DAY_FMT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric" };

export function DashboardPage() {
  useDocumentTitle("Home");
  const { state, can } = useAuth();

  const announcements = useQuery({
    queryKey: [...keys.announcements, "list", { limit: 6 }],
    queryFn: ({ signal }) => listAnnouncements({ limit: 6 }, signal),
  });
  const events = useQuery({
    queryKey: [...keys.events, "list", {}],
    queryFn: ({ signal }) => listEvents({ limit: 50 }, signal),
  });
  const openings = useQuery({
    queryKey: [...keys.openings, "list", { closingWithinDays: 30 }],
    queryFn: ({ signal }) => listOpenings({ closingWithinDays: 30, limit: 4 }, signal),
  });

  if (state.status !== "authenticated") return null;
  const { user } = state;
  const now = new Date();

  const anns = announcements.data?.items ?? [];
  const featured = anns.find((a) => a.pinned) ?? anns[0];
  const latest = anns.filter((a) => a.id !== featured?.id).slice(0, 4);
  const upcoming = (events.data?.items ?? []).filter((e) => Date.parse(e.endsAt) >= Date.now()).slice(0, 4);

  // Links shown under the date change with what this person is allowed to do (shared/permissions.ts)
  const links: Array<{ to: string; label: string; icon: IconName }> = [
    ...(can("announcement:create") ? [{ to: "/announcements/new", label: "Write an announcement", icon: "megaphone" as const }] : []),
    ...(can("event:create") ? [{ to: "/events/new", label: "Add an event", icon: "calendar" as const }] : []),
    ...(can("resource:create") ? [{ to: "/resources/upload", label: "Upload a resource", icon: "upload" as const }] : []),
    ...(can("user:read") ? [{ to: "/admin/users", label: "Manage users", icon: "users" as const }] : []),
  ];
  // Students reach sections through the Explore tiles below; the hero keeps personal shortcuts only
  links.push({ to: "/bookmarks", label: "Your bookmarks", icon: "bookmark" }, { to: "/search", label: "Search everything", icon: "search" });

  const firstName = user.name.split(" ")[0] ?? user.name;
  const nextDeadline = openings.data?.items[0];
  const nextEvent = upcoming[0];

  // Every tile shows one live line from real data — no invented numbers
  const tiles: Array<{ to: string; kind: Category; name: string; liveLabel: string; live: string; big?: boolean; wide?: boolean }> = [
    {
      to: "/resources", kind: "resources", name: "Study library", big: true,
      liveLabel: user.role === "student" ? "Your shelf" : "Library",
      live: user.role === "student" ? `Notes, slides and question banks for ${user.department}, Year ${user.year ?? ""}.` : "Notes and slides, organised by department, year, semester and subject.",
    },
    {
      to: "/announcements", kind: "news", name: "Announcements", wide: true,
      liveLabel: "Latest", live: featured?.title ?? (announcements.isPending ? "Loading…" : "Nothing new yet."),
    },
    {
      to: "/events", kind: "events", name: "Events",
      liveLabel: "Next", live: nextEvent ? `${nextEvent.title}, ${new Date(nextEvent.startsAt).toLocaleDateString("en-IN", DAY_FMT)}` : events.isPending ? "Loading…" : "Nothing scheduled yet.",
    },
    {
      to: "/openings", kind: "openings", name: "Opportunities",
      liveLabel: "Closest deadline",
      live: nextDeadline ? `${nextDeadline.company}, in ${Math.max(daysUntil(nextDeadline.closesAt), 0)} days` : openings.isPending ? "Loading…" : "No open deadlines.",
    },
  ];
  const scope = user.role === "student" ? `${user.department}, Year ${user.year ?? ""}`.trim() : null;

  return (
    <div className="page">
      <section className="hero hero-under-header on-night" aria-labelledby="page-title">
        <Aurora />
        <div className="container">
          <div className="almanac-grid">
            <div className="almanac">
              <p className="almanac-weekday">{now.toLocaleDateString("en-IN", { weekday: "long" })}</p>
              <p className="almanac-day" aria-hidden>
                {now.getDate()}
              </p>
              <p className="almanac-month">{now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
              <h1 id="page-title" tabIndex={-1} className="almanac-greet">
                {greeting(now)}, {firstName}.
                <span className="sr-only"> Today is {now.toLocaleDateString("en-IN", { dateStyle: "full" })}.</span>
              </h1>
              <p className="almanac-summary">
                {scope ? `Here's what's new for ${scope}.` : "Here's what's happening across campus."}
              </p>
            </div>

            <section className="agenda glass" aria-labelledby="agenda-h">
              <div className="agenda-head">
                <h2 id="agenda-h">Coming up</h2>
                <Link to="/events">All events</Link>
              </div>
              {events.isPending ? (
                <p className="agenda-empty">Loading events…</p>
              ) : upcoming.length === 0 ? (
                <p className="agenda-empty">Nothing scheduled for you yet.</p>
              ) : (
                <ol>
                  {upcoming.map((e) => (
                    <li key={e.id}>
                      <Link to={`/events/${e.id}`}>
                        <span className="agenda-when">
                          <b>{new Date(e.startsAt).toLocaleDateString("en-IN", DAY_FMT)}</b>
                          <span>{formatTime(e.startsAt)}</span>
                        </span>
                        <span className="agenda-what">
                          {e.title}
                          <span className="agenda-where">{e.venue}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <nav className="hero-links" aria-label="Shortcuts">
            {links.map((l) => (
              <Link key={l.to} to={l.to}>
                <Icon name={l.icon} size={18} />
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="container">
        <section className="section" aria-labelledby="explore-h">
          <div className="section-head">
            <h2 id="explore-h">Explore</h2>
          </div>
          <div className="bento">
            {tiles.map((t) => (
              <Link key={t.to} to={t.to} className={`tile${t.big ? " tile-lg" : ""}${t.wide ? " tile-wide" : ""}`} style={{ "--accent": `var(--cat-${t.kind})` } as React.CSSProperties}>
                <CategoryArt kind={t.kind} />
                <span className="tile-name">{t.name}</span>
                <span className="tile-live">
                  <small>{t.liveLabel}</small>
                  <span className="clamp-2">{t.live}</span>
                </span>
                <span className="tile-go" aria-hidden>
                  <Icon name="arrowRight" size={18} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="split section">
          <div className="stack stack-l">
            <section aria-labelledby="featured-h">
              <div className="section-head">
                <h2 id="featured-h">{featured?.pinned ? "Pinned" : "Latest"}</h2>
                <Link to="/announcements">All announcements</Link>
              </div>
              {announcements.isPending ? (
                <div className="skeleton skeleton-feature" />
              ) : announcements.isError ? (
                <ErrorState error={announcements.error} onRetry={() => void announcements.refetch()} />
              ) : featured ? (
                <article className="feature feature-night">
                  <CategoryArt kind="news" />
                  <h2>
                    <Link to={`/announcements/${featured.id}`}>{featured.title}</Link>
                  </h2>
                  <p className="clamp-3 lead">{featured.body}</p>
                  <p className="feature-meta">
                    <span>{featured.author.name}</span>
                    <span>{relativeDay(featured.publishAt ?? featured.createdAt)}</span>
                    <span>For {forAudience(featured.audience)}</span>
                  </p>
                </article>
              ) : (
                <EmptyState icon="megaphone" title="Nothing announced yet" body="New announcements for you will appear here." />
              )}
            </section>

            {latest.length > 0 && (
              <section aria-labelledby="latest-h">
                <h2 id="latest-h" className="sr-only">
                  More announcements
                </h2>
                <div className="feed">
                  {latest.map((a) => (
                    <AnnouncementRow key={a.id} a={a} />
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside aria-labelledby="deadlines-h">
            <div className="section-head">
              <h2 id="deadlines-h">Deadlines</h2>
              <Link to="/openings">All opportunities</Link>
            </div>
            {openings.isPending ? (
              <div className="skeleton" style={{ height: 220 }} />
            ) : openings.isError ? (
              <ErrorState error={openings.error} onRetry={() => void openings.refetch()} />
            ) : openings.data.items.length ? (
              <ul className="deadlines">
                {openings.data.items.map((o) => {
                  const d = Math.max(daysUntil(o.closesAt), 0);
                  return (
                    <li key={o.id}>
                      <Link to={`/openings/${o.id}`}>
                        <span className={`days-left${d <= 3 ? " urgent" : ""}`}>
                          <b>{d}</b>
                          <span>{d === 1 ? "day left" : "days left"}</span>
                        </span>
                        <span>
                          <strong>{o.title}</strong>
                          <small>
                            {o.company}, {o.type === "job" ? "job" : "internship"}
                          </small>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon="briefcase" title="No deadlines this month" />
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

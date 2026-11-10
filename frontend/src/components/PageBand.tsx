import type { CSSProperties, ReactNode } from "react";
import { CATEGORY_VAR, CategoryArt, type Category } from "./Art";

/** Slow-moving light behind night surfaces. Transform-only animation; off under reduced motion. */
export function Aurora({ accent = "var(--color-mint)" }: { accent?: string }) {
  return (
    <div className="aurora" aria-hidden style={{ "--accent": accent } as CSSProperties}>
      <span className="blob b1" />
      <span className="blob b2" />
      <span className="blob b3" />
    </div>
  );
}

/**
 * Opening band for every top-level section page: night surface, section colour,
 * the section's illustration, title and actions. Same structure on every section,
 * so the app feels like one product.
 */
export function PageBand({
  kind,
  title,
  lead,
  actions,
  children,
}: {
  kind: Category;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="band hero-under-header on-night" style={{ "--accent": CATEGORY_VAR[kind] } as CSSProperties}>
      <Aurora accent={CATEGORY_VAR[kind]} />
      <div className="container band-inner">
        <div className="band-copy">
          <span className="band-dot" aria-hidden />
          <h1 id="page-title" tabIndex={-1}>
            {title}
          </h1>
          {lead && <p className="band-lead">{lead}</p>}
          {actions && <div className="row band-actions">{actions}</div>}
        </div>
        <CategoryArt kind={kind} className="band-art" />
      </div>
      {children && <div className="container band-extra">{children}</div>}
    </section>
  );
}

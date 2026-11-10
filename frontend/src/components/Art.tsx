// Original line illustrations, one per section, drawn in code (no stock art, no downloads).
// Purely decorative: hidden from screen readers.
import type { CSSProperties } from "react";

export type Category = "news" | "events" | "resources" | "openings";

export const CATEGORY_VAR: Record<Category, string> = {
  news: "var(--cat-news)",
  events: "var(--cat-events)",
  resources: "var(--cat-resources)",
  openings: "var(--cat-openings)",
};

export function CategoryArt({ kind, className }: { kind: Category; className?: string }) {
  const c = CATEGORY_VAR[kind];
  const common = { className: `art ${className ?? ""}`, viewBox: "0 0 320 220", fill: "none", "aria-hidden": true, focusable: "false" as const };
  if (kind === "news") {
    // Broadcast: rings spreading from a single point
    return (
      <svg {...common}>
        {[28, 56, 84, 112, 140, 168].map((r, i) => (
          <circle key={r} cx="70" cy="150" r={r} stroke={c} strokeOpacity={0.9 - i * 0.13} strokeWidth="1.2" strokeDasharray={i % 2 ? "2 6" : undefined} />
        ))}
        <circle cx="70" cy="150" r="7" fill={c} />
        <circle cx="70" cy="150" r="16" stroke={c} strokeOpacity="0.5" />
        <path d="M150 64h120M150 84h96M150 104h110" stroke="#fff" strokeOpacity="0.28" strokeWidth="6" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === "events") {
    // A month of dots; a few days lit, one ringed
    const lit = new Set([3, 9, 10, 16, 24, 30]);
    return (
      <svg {...common}>
        {Array.from({ length: 35 }, (_, i) => {
          const x = 40 + (i % 7) * 40;
          const y = 30 + Math.floor(i / 7) * 38;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={lit.has(i) ? 6 : 2.5} fill={lit.has(i) ? c : "#fff"} fillOpacity={lit.has(i) ? 1 : 0.35} />
              {i === 16 && <circle cx={x} cy={y} r="14" stroke={c} strokeWidth="1.2" />}
            </g>
          );
        })}
      </svg>
    );
  }
  if (kind === "resources") {
    // Stacked pages, each with ruled lines
    return (
      <svg {...common}>
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${70 + i * 34} ${60 - i * 22}) rotate(${-8 + i * 6})`}>
            <rect width="130" height="160" rx="10" fill="#0e1726" stroke={i === 2 ? c : "#fff"} strokeOpacity={i === 2 ? 1 : 0.35} strokeWidth="1.2" />
            {[30, 50, 70, 90, 110].map((y) => (
              <path key={y} d={`M18 ${y}h${y === 30 ? 60 : 94}`} stroke={i === 2 ? c : "#fff"} strokeOpacity={i === 2 ? 0.85 : 0.25} strokeWidth={y === 30 ? 5 : 2} strokeLinecap="round" />
            ))}
          </g>
        ))}
      </svg>
    );
  }
  // Openings: a rising path with milestones
  return (
    <svg {...common}>
      <path d="M20 190 L90 150 L150 160 L210 100 L260 70 L300 30" stroke={c} strokeWidth="1.6" />
      <path d="M20 200 L300 200" stroke="#fff" strokeOpacity="0.25" />
      {[[90, 150], [150, 160], [210, 100], [260, 70]].map(([x, y]) => (
        <circle key={`${x}`} cx={x} cy={y} r="5" fill="#0e1726" stroke={c} strokeWidth="1.6" />
      ))}
      <circle cx="300" cy="30" r="9" fill={c} />
      {[60, 120, 180, 240].map((x) => (
        <path key={x} d={`M${x} 200 V${206}`} stroke="#fff" strokeOpacity="0.3" />
      ))}
    </svg>
  );
}

/** Deterministic number from a string id, so a cover never changes between visits. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const COVER_PAIRS: Array<[string, string]> = [
  ["#9fc8ff", "#a8e6cf"],
  ["#a8e6cf", "#2b5c8f"],
  ["#9fc8ff", "#f2cf8d"],
  ["#f5a894", "#9fc8ff"],
  ["#a8e6cf", "#f2cf8d"],
];

/** Abstract gradient cover for events (not a poster: it carries no invented content). */
export function coverStyle(seed: string): CSSProperties {
  const h = hash(seed);
  const [a, b] = COVER_PAIRS[h % COVER_PAIRS.length]!;
  const x1 = 15 + (h % 50);
  const y1 = 20 + ((h >> 5) % 50);
  const x2 = 50 + ((h >> 9) % 45);
  return {
    backgroundColor: "#0e1726",
    backgroundImage: `radial-gradient(60% 90% at ${x1}% ${y1}%, ${a}cc, transparent 70%), radial-gradient(50% 80% at ${x2}% 90%, ${b}aa, transparent 70%), var(--grain)`,
  };
}

/** Company monogram for opportunity cards. */
export function Monogram({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span className="monogram" aria-hidden style={coverStyle(name)}>
      {letters}
    </span>
  );
}

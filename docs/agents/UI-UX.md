# UI-UX.md — Smart Campus Companion
### Design system, 3D character system, Figma workflow and implementation brief

> **Who this file is for:** an AI coding/design agent (Claude Code, Antigravity, Cursor, etc.) plus the teammate who owns UI/UX.
> **What it produces:** (1) a Figma file with foundations, components, 3D renders and every screen; (2) the 3D character assets; (3) the `ui` component library and the visual layer of `frontend`, implemented exactly as designed.
> **Read first:** `AGENTS.md` (shared rules, repo layout, API contract). If anything here conflicts with `AGENTS.md`, `AGENTS.md` wins for code rules; this file wins for visual and interaction decisions.

---

## 0. Agent operating instructions

### 0.1 Your role
You are the **UI/UX and 3D design agent**. You own:

| You own | You do NOT own |
|---|---|
| Design tokens, typography, grid, motion rules | API calls, auth logic, data fetching (Frontend agent) |
| Figma file: foundations, components, screens, prototype | Server code, DB schemas (Backend / Database agents) |
| 3D character + scene assets, fallbacks, 3D runtime | Business rules, permissions (they come from `shared`) |
| `ui` (presentational React components) | Page wiring inside `frontend/src/pages/**` beyond layout shells |
| Accessibility, responsive behaviour, microcopy | Deployment |

### 0.2 Order of work (do not skip or reorder)
1. **Read** this file end to end, then `AGENTS.md`, then `shared/src/permissions.ts` (roles) and the API error codes in §16.
2. **Plan mode first.** Write a short plan (files you will touch, assets you will create) and wait for human approval.
3. **Foundations in Figma** (§8.2 pages 1–2): variables, type styles, grid, effects.
4. **3D character** (§7): build the procedural model, render stills, export fallbacks. Put stills in Figma page "3D".
5. **Components in Figma** (§6), then **the same components in code** (`ui`). Figma and code must use identical token names.
6. **Screens in Figma** (§9), desktop + mobile, then a clickable prototype of the auth flow.
7. **Implement screens' visual layer** in `frontend` using only `ui` components and tokens.
8. **Verify** with the checklists in §12 (a11y), §13 (performance) and §17 (Definition of Done). Attach screenshots to the PR.

### 0.3 Hard rules
- **Inspiration, not copying.** The visual reference (§2.1) is a commercial template. Never copy its code, text, images, logos, brand names or 3D models. We take the *mood and techniques* only. Our mascot, copy and assets are original.
- **Tokens only.** No raw hex values, pixel font sizes or ad-hoc shadows in components. Everything comes from §3.
- **Every interactive component** ships with: default, hover, focus-visible, active, disabled, loading, error states, plus keyboard support and an accessible name.
- **3D is decoration, never function.** Every 3D scene has an image fallback and the page must be fully usable with WebGL off, JS slow, or `prefers-reduced-motion: reduce`.
- **Security-safe UI** (§14): no `dangerouslySetInnerHTML`, no third-party CDNs, no inline `<script>`, self-hosted fonts and models, no tokens in `localStorage`.
- **Ask before adding any dependency** not listed in §15.1.
- Small PRs: one component group or one screen group per branch (`feature/ui-<name>`).

---

## 1. Product context

**Smart Campus Companion** is one dashboard for a college: announcements, events, study resources and job/internship openings. Target load is **1 lakh users** now, scaling to 10–20 lakh later, so the UI must be **fast on cheap Android phones on 4G** while still feeling premium on a laptop.

### 1.1 Roles and what they come for

| Role | Main jobs | Visual priority |
|---|---|---|
| **Student** | See what's new for *my* department/year, find notes, track openings, RSVP events | Fast scanning, mobile-first, bookmarks |
| **Faculty** | Publish announcements/events/resources, see reach | Clean editor, preview, clear publish state |
| **Moderator** | Approve the queue, remove bad content | Dense queue, keyboard shortcuts |
| **Placement officer** | Post and manage openings, eligibility | Forms with validation, deadlines |
| **Admin** | Users, roles, suspensions, audit log, analytics | Data tables, step-up confirmations, safety |

### 1.2 Experience principles
1. **Calm intelligence.** Dark, quiet, editorial. The product feels like a smart instrument, not a noisy notice board.
2. **One glance, one answer.** Every screen answers its main question above the fold on a 360 × 740 phone.
3. **The companion has a personality, the interface does not shout.** Character and motion live in the 3D mascot and a few signature details; the rest is restrained.
4. **Trust is visible.** Security states (MFA, sessions, step-up, "who can see this post") are designed, not bolted on.
5. **Accessible by default.** WCAG 2.2 AA is a requirement, not a stretch goal.

---

## 2. Design direction — "Midnight Editorial × Ceramic Companion"

### 2.1 Reference analysis (aura.build "Agent AI" template)
What we **take** as technique/mood:

| Technique in reference | How we use it |
|---|---|
| Near-black violet background with thin vertical **grid rails** fixed behind content | Same idea, our own rail positions and colours (§4.2) |
| **Monospace uppercase eyebrows** and spec lists (`SYSTEM ONLINE`, `01 / 05`) | Campus-flavoured labels: `ANNOUNCEMENTS · CSE · YEAR 3`, `03 / 12` |
| **Iridescent hairline** gradient on key edges (nav top, primary CTA border) | Our own "aurora" gradient (§3.1) |
| **Chamfered (cut-corner) buttons and tags** via `clip-path` | Signature shape for buttons, badges, number tags |
| **Corner-bracket** highlights around words/headlines | Used on hero headline and empty states |
| Large **ceramic 3D character** with glowing eyes that **follows the cursor** | Our original mascot **"Nova"**, a ceramic owl-bot (§7) |
| One **fixed full-screen WebGL canvas** rendering multiple "scene" slots | Same architecture via `@react-three/drei` `<View>` (§7.6) |
| **Sticky stacked cards** on scroll, snap carousels | Landing page features + events carousel |
| Glass header with `backdrop-filter: blur` | App header and dropdowns |
| Image fallbacks for every 3D scene, reduced-motion handling, DPR cap | Mandatory (§7.8) |

What we **do not** take: their copy, names, logos, robot model, product sections, exact colours, exact layout proportions.

### 2.2 Mood keywords
`nocturnal` · `editorial` · `instrument-panel` · `ceramic` · `warm-signal` · `quiet confidence`

### 2.3 Two surfaces, one system
| Surface | Where | 3D | Density |
|---|---|---|---|
| **Showcase** | Landing, auth pages, 404/500, onboarding | Full hero scenes | Airy, large type |
| **Workspace** | Dashboards, lists, editors, admin | Tiny mascot accents only (greeting, empty states) | Compact, data-first |

The workspace must never load the heavy 3D bundle unless a mascot accent is on screen (§13).

---

## 3. Design tokens

Token names are **identical** in Figma Variables and in CSS. Collections in Figma: `color`, `space`, `radius`, `type`, `motion`, `elevation`. Modes: `dark` (default) and `light` (optional, phase 2).

### 3.1 Colour

| Token | Dark value | Use |
|---|---|---|
| `--color-bg` | `#09080D` | Page background |
| `--color-bg-raised` | `#0F0D14` | Cards, panels |
| `--color-bg-sunken` | `#060509` | Inputs, code, wells |
| `--color-bg-overlay` | `#0C0A11F0` | Header, dropdowns, modals (with blur) |
| `--color-line` | `#221E2A` | Rails, borders, dividers |
| `--color-line-strong` | `#3A3345` | Input borders, hover borders |
| `--color-ink` | `#EDEBF0` | Primary text |
| `--color-ink-2` | `#C2BDC9` | Body text |
| `--color-muted` | `#8A8492` | Secondary text, eyebrows (≥ 4.5:1 on bg) |
| `--color-faint` | `#5E5867` | Disabled text, placeholders (decorative only) |
| `--color-signal` | `#FF7A2E` | Brand accent: mascot eyes, primary focus moments, live dots |
| `--color-signal-soft` | `#FF7A2E1F` | Accent backgrounds |
| `--color-focus` | `#8FE6D6` | Focus ring (always visible, ≥ 3:1) |
| `--color-success` | `#5FD39A` | Success states |
| `--color-warning` | `#F2C94C` | Warnings, closing-soon deadlines |
| `--color-danger` | `#FF5D6C` | Errors, destructive actions |
| `--color-info` | `#6CB8FF` | Info notices |

**Aurora gradient** (signature hairline, use sparingly — max 3 places per screen):
```
--aurora: linear-gradient(120deg, #7BE8C8 0%, #5BC2DB 25%, #8B5BE0 50%, #E0687E 75%, #EBD877 100%);
```

**Role accents** (badges and avatars only, never large fills):
`--role-student #6CB8FF` · `--role-faculty #5FD39A` · `--role-moderator #B78CF0` · `--role-placement #F2C94C` · `--role-admin #FF7A2E`

Contrast rule: any text token on any bg token used together must pass **4.5:1** (body) or **3:1** (≥ 24px / bold 19px). Verify in Figma with a contrast plugin and in CI with axe (§12).

### 3.2 Typography
Fonts are **self-hosted** via `@fontsource-variable/geist` and `@fontsource-variable/geist-mono` (OFL licence). No Google Fonts CDN.

| Token | Family | Size / line-height | Tracking | Use |
|---|---|---|---|---|
| `display-xl` | Geist | `clamp(48px, 6vw, 88px)` / 1.05 | -0.045em | Landing hero |
| `display-l` | Geist | `clamp(36px, 4vw, 56px)` / 1.1 | -0.03em | Auth hero, section titles |
| `heading-1` | Geist 500 | 32 / 1.2 | -0.02em | Page titles |
| `heading-2` | Geist 500 | 24 / 1.25 | -0.015em | Card group titles |
| `heading-3` | Geist 500 | 18 / 1.35 | -0.01em | Card titles |
| `body-l` | Geist | 17 / 1.55 | 0 | Hero descriptions |
| `body` | Geist | 15 / 1.55 | 0 | Default text |
| `body-s` | Geist | 13 / 1.5 | 0 | Meta, helper text |
| `mono-label` | Geist Mono | 11 / 1.4, UPPERCASE | 0.06em | Eyebrows, spec lists, nav, buttons |
| `mono-data` | Geist Mono | 13 / 1.4 | 0 | Numbers, codes, timestamps |

Rules: headings weight 400–500 (never bold 700 for display), body never below 13px, all-caps only in `mono-label`.

### 3.3 Spacing, radius, elevation, motion

```
--space-1: 4px   --space-2: 8px   --space-3: 12px  --space-4: 16px
--space-5: 20px  --space-6: 24px  --space-8: 32px  --space-10: 40px
--space-12: 48px --space-16: 64px --space-24: 96px --space-32: 128px

--radius-none: 0     /* default: the system is mostly sharp */
--radius-s: 4px      /* inputs */
--radius-m: 8px      /* images, avatars-square */
--radius-full: 999px /* status dots, avatars */
--chamfer: 8px       /* clip-path cut size for buttons/tags */
--chamfer-s: 6px

--shadow-stack: 0 -16px 38px #00000059;   /* sticky stacked cards */
--shadow-pop: 0 12px 40px #00000080;      /* dropdowns, modals */
--glow-signal: 0 0 24px #FF7A2E59;        /* live elements only */
--blur-glass: 18px;

--ease-out: cubic-bezier(.22,.68,0,1.01); /* signature ease, slight overshoot */
--ease-in-out: cubic-bezier(.65,0,.35,1);
--dur-1: 120ms  /* hover colour */
--dur-2: 220ms  /* small UI */
--dur-3: 400ms  /* panels, reveals */
--dur-4: 800ms  /* hero, image zoom */
```

### 3.4 Tailwind v4 implementation (`ui/src/styles/tokens.css`)
```css
@import "tailwindcss";
@import "@fontsource-variable/geist";
@import "@fontsource-variable/geist-mono";

@theme {
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono Variable", ui-monospace, monospace;

  --color-bg: #09080D;  --color-bg-raised: #0F0D14;  --color-bg-sunken: #060509;
  --color-bg-overlay: #0C0A11F0;
  --color-line: #221E2A; --color-line-strong: #3A3345;
  --color-ink: #EDEBF0; --color-ink-2: #C2BDC9; --color-muted: #8A8492; --color-faint: #5E5867;
  --color-signal: #FF7A2E; --color-signal-soft: #FF7A2E1F; --color-focus: #8FE6D6;
  --color-success: #5FD39A; --color-warning: #F2C94C; --color-danger: #FF5D6C; --color-info: #6CB8FF;

  --ease-out: cubic-bezier(.22,.68,0,1.01);
  --ease-in-out: cubic-bezier(.65,0,.35,1);
}

:root {
  --aurora: linear-gradient(120deg,#7BE8C8 0%,#5BC2DB 25%,#8B5BE0 50%,#E0687E 75%,#EBD877 100%);
  --chamfer: 8px; --chamfer-s: 6px; --blur-glass: 18px;
  color-scheme: dark;
}

html { scroll-behavior: smooth; scroll-padding-top: 88px; }
body { background: var(--color-bg); color: var(--color-ink); font-family: var(--font-sans);
       -webkit-font-smoothing: antialiased; overflow-x: clip; }

:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 4px; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important;
                           transition-duration: 1ms !important; scroll-behavior: auto !important; }
}
```

---

## 4. Layout system

### 4.1 Breakpoints and grid

| Name | Min width | Columns | Margin | Gutter |
|---|---|---|---|---|
| `xs` | 0 | 4 | 16px | 12px |
| `sm` | 640px | 6 | 24px | 16px |
| `md` | 900px | 6 | 32px | 20px |
| `lg` | 1200px | 12 | 1/12 of viewport (the "rail gutter") | 24px |
| `xl` | 1600px | 12 | 1/12, content max 1440px | 24px |

### 4.2 Grid rails (signature background)
A fixed, non-interactive overlay draws 1px vertical lines in `--color-line` at **8.333%, 50%, 91.667%** (lg+) and **at 50% only** on mobile. Opacity 0.6. Content aligns to these rails: page titles start on the left rail, primary actions end on the right rail.

```css
.rails::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: .6;
  background: linear-gradient(90deg,
    transparent calc(8.333% - 1px), var(--color-line) 8.333%, transparent calc(8.333% + 1px),
    transparent calc(50% - 1px),    var(--color-line) 50%,    transparent calc(50% + 1px),
    transparent calc(91.667% - 1px),var(--color-line) 91.667%,transparent calc(91.667% + 1px));
}
@media (max-width: 899px) { .rails::before { background: linear-gradient(90deg,
    transparent calc(50% - 1px), var(--color-line) 50%, transparent calc(50% + 1px)); opacity: .35; } }
```

### 4.3 App shells

**Showcase shell:** glass header (64px) + optional announcement strip (28px, dismissible) + full-bleed sections + section rail (right side dots, lg+ only) + footer.

**Workspace shell:**
- lg+: left sidebar 248px (collapsible to 72px), top bar 64px (search ⌘K, notifications, profile menu), content area max 1200px.
- < lg: top bar 56px + **bottom tab bar** (Home, Resources, Events, Openings, Me) with 48px min touch targets; sidebar becomes a drawer.
- Admin tables switch to stacked cards below `md`.

---

## 5. Signature elements (build these first, reuse everywhere)

| Element | Spec |
|---|---|
| **Chamfer shape** | `clip-path: polygon(var(--chamfer) 0,100% 0,100% calc(100% - var(--chamfer)),calc(100% - var(--chamfer)) 100%,0 100%,0 var(--chamfer));` Top-left and bottom-right corners cut. Used on buttons, tags, number badges. Borders on chamfered elements are drawn with an inner pseudo-element or `background` padding-box trick, because `border` gets clipped. |
| **Aurora border** | `background: linear-gradient(var(--color-bg),var(--color-bg)) padding-box, var(--aurora) border-box; border: 1px solid transparent;` For the primary CTA and the active nav item only. |
| **Aurora hairline** | 1px `var(--aurora)` line on the top edge of the header's centre segment and under the hero scroll progress. |
| **Corner brackets** | Two L-shaped 1px brackets (top-left, bottom-right) around a word or a card in `--color-line-strong`; aurora version for the hero keyword. |
| **Mono eyebrow** | `mono-label`, `--color-muted`, preceded by `··` or a 5px pulsing dot for live data. Example: `● LIVE · 3 NEW FOR CSE · YEAR 3`. |
| **Spec list** | Right-aligned mono list with bottom dividers, used for metadata (venue, date, capacity, uploader). |
| **Index counter** | `01 / 05` in `mono-data`, used on carousels and step flows (e.g., MFA setup `02 / 03`). |
| **Status pulse** | 5px `--color-signal` dot, 2s ease pulse; replaced by a static dot under reduced motion. |
| **Section rail** | Fixed right-side vertical dots for landing sections; active dot gets corner brackets; label of current section in mono below. |
| **Ruler strip** | 24px tall strip of 1px ticks every 22px, top of cards in carousels (decorative, `aria-hidden`). |

---

## 6. Component library (`ui`)

Every component: TypeScript props, forwards `ref`, accepts `className`, uses tokens only, has a Figma counterpart with the **same name and variant names**, and has a story/preview page (`frontend/src/dev/ui-gallery.tsx`, dev-only route).

### 6.1 Inventory

| Component | Variants / props | Key behaviour and a11y |
|---|---|---|
| `Button` | `variant: primary \| secondary \| ghost \| danger \| link`, `size: s \| m \| l`, `loading`, `iconLeft/Right` | Chamfered. Primary = aurora border + ink text, hover fills `bg-raised`. Loading keeps width, shows 3-dot mono spinner, sets `aria-busy`. Min height 44px (m). |
| `IconButton` | `label` (required), `size` | `aria-label` mandatory; 44×44 hit area. |
| `TextField` | `label`, `hint`, `error`, `type`, `prefix/suffix` | Label always visible (no placeholder-as-label). Error text linked via `aria-describedby`, red left border + icon, never colour alone. |
| `PasswordField` | `showStrength`, `autoComplete` | Show/hide toggle (`aria-pressed`), strength meter (length-based + "found in a breach" message from API), caps-lock warning. |
| `OtpField` | `length=6` | One input with `inputmode="numeric"`, `autocomplete="one-time-code"`, visually split into 6 boxes; paste support. |
| `Select`, `Combobox` | `options`, `multiple` | Native `<select>` on mobile; Combobox follows WAI-ARIA pattern. Used for dept/year/sem/subject filters. |
| `Checkbox`, `Radio`, `Switch` | | Real inputs, 24px targets, labels clickable. |
| `Card` | `variant: plain \| interactive \| stacked`, `eyebrow`, `meta` | Interactive cards are a single link with a clear focus ring; no nested buttons inside the link. |
| `Tag` / `Badge` | `tone: neutral \| signal \| success \| warning \| danger \| role-*` | Chamfer-s, mono-label text. Role badge shows role name text, not colour only. |
| `Tabs` | `items`, `variant: line \| boxed` | Roving tabindex, arrow-key navigation, `aria-selected`. Boxed variant mirrors the reference's outlined tab row. |
| `Dialog` | `size`, `title`, `description` | Focus trap, `Esc` closes (except destructive confirmation in progress), returns focus to trigger, `inert` background. |
| `StepUpDialog` | `reason`, `methods: password \| totp` | Shown when API returns `STEP_UP_REQUIRED`. Explains *why* ("Changing a role needs a fresh check"). |
| `ConfirmDialog` | `danger`, `confirmText`, `typeToConfirm?` | Destructive actions name the target ("Suspend Riya Sen?"). Optional type-to-confirm for bulk deletes. |
| `Toast` | `tone`, `action` | `role="status"` (polite) for success, `role="alert"` for errors; auto-dismiss 6s, pauses on hover/focus. |
| `Banner` | `tone`, `dismissible` | Page-level notices (e.g., "MFA required before you continue"). |
| `Table` | `columns`, `rows`, `sort`, `selection`, `density` | Real `<table>`, sticky header, sortable headers are buttons with `aria-sort`; collapses to cards below `md`. |
| `Pagination` | cursor-based: `hasNext`, `hasPrev` | "Load more" on mobile, prev/next on desktop. |
| `EmptyState` | `title`, `body`, `action`, `art: mascot-pose` | Uses a Nova still (WebP) — not live 3D — in the workspace. |
| `Skeleton` | `shape` | Shimmer disabled under reduced motion. |
| `Avatar` | `name`, `src`, `role` | Initials fallback, role ring. |
| `DropdownMenu` | | Menu button pattern, glass background. |
| `CommandPalette` | | ⌘K / Ctrl K global search across 4 content types, grouped results, recent searches, fully keyboard driven. |
| `FilterBar` | dept → year → sem → subject | Chips show active filters; URL-synced (Frontend agent wires state). |
| `DeadlineChip` | `closesAt` | "Closes in 2 days" (warning ≤ 3 days, danger ≤ 24h), full date in `title` and visually hidden text. |
| `SessionRow` | device, browser, location, last active, current | Used on Security page; "This device" badge; revoke button. |
| `AudienceBadge` | `departments`, `years` | Shows who can see a post: `CSE · ECE · Y3`. |
| `ScenePlaceholder` | `scene`, `fallbackSrc`, `alt` | Slot that the 3D canvas renders into (§7.6). |

### 6.2 Button reference implementation
```tsx
// ui/src/components/Button.tsx
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "s" | "m" | "l";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant; size?: Size; loading?: boolean; iconLeft?: ReactNode; iconRight?: ReactNode;
}

const base = "relative inline-flex items-center justify-center gap-2 font-mono uppercase tracking-[.06em] " +
  "transition-[color,background-color,border-color] duration-200 ease-[var(--ease-out)] " +
  "disabled:opacity-40 disabled:cursor-not-allowed select-none";

const shapes: Record<Size, string> = {
  s: "h-9 px-4 text-[11px] chamfer-s",
  m: "h-11 px-5 text-[11px] chamfer",
  l: "h-13 px-7 text-[12px] chamfer",
};

const variants: Record<Variant, string> = {
  primary: "aurora-border text-ink hover:bg-bg-raised",
  secondary: "border border-line-strong text-ink-2 hover:text-ink hover:border-muted hover:bg-bg-raised",
  ghost: "text-ink-2 hover:text-ink hover:bg-bg-raised",
  danger: "border border-danger/60 text-danger hover:bg-danger/10",
  link: "h-auto px-0 normal-case tracking-normal font-sans text-ink underline-offset-4 hover:underline",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "m", loading, iconLeft, iconRight, children, className, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={cn(base, variant !== "link" && shapes[size], variants[variant], className)}
      disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <span className="dots" aria-hidden /> : iconLeft}
      <span className={loading ? "opacity-70" : undefined}>{children}</span>
      {!loading && iconRight}
    </button>
  );
});
```
```css
/* ui/src/styles/signature.css */
.chamfer   { clip-path: polygon(var(--chamfer) 0,100% 0,100% calc(100% - var(--chamfer)),calc(100% - var(--chamfer)) 100%,0 100%,0 var(--chamfer)); }
.chamfer-s { clip-path: polygon(var(--chamfer-s) 0,100% 0,100% calc(100% - var(--chamfer-s)),calc(100% - var(--chamfer-s)) 100%,0 100%,0 var(--chamfer-s)); }
.aurora-border { background: linear-gradient(var(--color-bg),var(--color-bg)) padding-box, var(--aurora) border-box;
                 border: 1px solid transparent; }
.aurora-border:hover { background: linear-gradient(var(--color-bg-raised),var(--color-bg-raised)) padding-box, var(--aurora) border-box; }
.dots::after { content: "···"; letter-spacing: .2em; animation: dots 1s steps(4) infinite; }
@keyframes dots { 0%{content:""} 25%{content:"·"} 50%{content:"··"} 75%{content:"···"} }
```
> Chamfered elements lose their normal focus outline to `clip-path`. Fix: wrap each chamfered control in a `span.focus-ring` that draws a 2px chamfered outline in `--color-focus` on `:focus-within`. Test it with keyboard on every variant.

---

## 7. 3D character system — "Nova"

### 7.1 Concept
**Nova** is the campus companion: a small, rounded **ceramic owl-bot** (owls = wisdom, a natural campus symbol), warm off-white glazed ceramic with a satin graphite face visor and two large **glowing signal-orange eyes** made of soft LED discs. Tiny ear tufts double as antenna fins. A slim graduation-cap ridge on the head reads as "campus" without being a cartoon hat. It is original and must not resemble the reference template's robot (different silhouette: owl body, ear fins, cap ridge, no humanoid limbs).

| Attribute | Spec |
|---|---|
| Silhouette | Egg-shaped body (height 1.0), head merged into body (owl style), two stubby wing panels, two ear fins |
| Body material | Ceramic: base `#F1ECE4`, roughness 0.35, clearcoat 1.0, clearcoat roughness 0.12, sheen 0.3 |
| Visor | Graphite `#17141C`, roughness 0.25, metalness 0.1 |
| Eyes | Emissive `--color-signal` `#FF7A2E`, intensity 2.2 (idle) → 3.5 (excited); thin inner iris ring `#FFD2B0` |
| Chest core | Small emissive slit in aurora teal `#7BE8C8`, pulses with "thinking" state |
| Base | Optional floating ring shadow (contact shadow, no pedestal) |
| Poly budget | ≤ 20k triangles for the hero; ≤ 6k for the mini version |

### 7.2 Poses and states (drive from app state)

| State | Trigger in app | Animation |
|---|---|---|
| `idle` | default | Slow breathing scale 1 → 1.012 (4s), blink every 3–6s random, eyes follow cursor (§7.5) |
| `greet` | landing load, successful login | Small hop + head tilt 8°, eyes widen |
| `thinking` | form submitting, search loading | Chest core pulse, eyes narrow to arcs, slight head bob |
| `success` | registration done, MFA enabled, publish success | Nod twice, eyes flash brighter |
| `error` | `INVALID_CREDENTIALS`, validation error | Head shake ±6° (2 cycles), eyes squint, no red (we don't shame users) |
| `locked` | `ACCOUNT_LOCKED`, `RATE_LIMITED` | Eyes dim to 40%, wings fold, holds still |
| `shield` | MFA setup, security page header | Wings wrap forward, eyes teal `#8FE6D6` |
| `sleep` | 404 / offline / maintenance | Eyes closed as lines, floating "z" particles (3) |

Expose this as a tiny store: `useNova.getState().setMood("thinking")`. The Frontend agent calls it from auth flows; you own the store and the animations.

### 7.3 Scene list

| Scene id | Where | Camera / framing | Interaction |
|---|---|---|---|
| `hero` | Landing hero | Nova 3/4 view, right of headline, 45% viewport width (lg) | Gaze follow, `greet` on load, scroll-linked slow rotation (±12°) |
| `auth` | Login / register / MFA left panel | Head-and-shoulders close-up | Gaze follows the **focused input** (eyes look toward the active field) |
| `network` | Landing "Everything in one place" section | Nova centre with 4 floating ceramic tiles (Announcements, Events, Resources, Openings) orbiting slowly | Hover a tile → it lifts and its label highlights |
| `shield` | Landing security section + Security settings header | Nova in `shield` pose with a translucent hex barrier | Barrier ripples on pointer |
| `mini` | Dashboard greeting (lg+ only) | 96×96 head only | Blinks; `success` after actions |
| `sleep` | 404, offline | Full body, sleeping | none |

Empty states use **pre-rendered WebP stills**, not live 3D.

### 7.4 Building the model (two allowed routes)

**Route A — procedural in code (default, recommended for AI agents).** Build Nova from three.js primitives so there is no binary asset pipeline and every proportion is a reviewable number:
- Body: `LatheGeometry` from an egg profile curve (24 segments) or `SphereGeometry` scaled (1, 1.15, 0.95).
- Visor: `SphereGeometry` slice (`phiStart/phiLength/thetaLength`) offset forward.
- Eyes: `CircleGeometry` discs + `TorusGeometry` iris rings, `MeshStandardMaterial` emissive.
- Wings: `CapsuleGeometry` flattened (scale z 0.35), rotated.
- Ear fins: `ConeGeometry` with 4 radial segments, rounded via bevel-like scaling.
- Use `@react-three/drei` `RoundedBox` / `Capsule` where helpful.

**Route B — Blender → GLB** (if the team wants a sculpted look). The agent writes a **Blender Python script** (`ui/design/3d/nova_build.py`) that models Nova with the proportions above so the model is reproducible, then exports `nova.glb`. Post-process with `@gltf-transform/cli`:
```
npx @gltf-transform/cli optimize nova.glb nova.opt.glb --compress meshopt --texture-compress webp
```
Budget: `nova.opt.glb` ≤ **400 KB**. Serve from `frontend/public/3d/` (same origin, long cache, hashed filename).

Either route: the model is original. Do not import any downloaded/marketplace character.

### 7.5 Behaviour details
- **Gaze:** map pointer position relative to the scene slot to head yaw ±18° and pitch ±10°, eyes add another ±6°; damp with `THREE.MathUtils.damp(current, target, 6, dt)`. Only for `(hover: hover) and (pointer: fine)`; on touch, idle drift instead. Reset to neutral on `pointerleave`, `blur`, `visibilitychange`.
- **Auth gaze:** when an input is focused, aim at that input's bounding box centre; when the password field is focused and "show password" is off, Nova **covers its eyes with its wings** (playful privacy cue). Respect reduced motion (just dim eyes).
- **Scroll:** landing hero rotation and slight dolly linked to scroll progress of the 160vh hero track (sticky inner).
- **Never** animate layout properties from the render loop; React state updates from 3D only on discrete events.

### 7.6 Runtime architecture (`frontend/src/three/`)
- **One** fixed full-viewport `<Canvas>` (`@react-three/fiber`) mounted at the shell level, `pointer-events: none`, `z-index` below interactive content but above background rails.
- Each page places `<ScenePlaceholder scene="hero" />` divs; drei's `<View track={ref}>` renders each scene into its placeholder's rectangle (scissor), so we keep **one WebGL context**.
- The canvas module is **lazy-loaded** (`React.lazy` + dynamic `import()`) only on routes that contain a placeholder, after first paint and when the placeholder is near the viewport (IntersectionObserver, `rootMargin: 200px`).
- Renderer: `antialias: true`, `powerPreference: "high-performance"`, `dpr={[1, 1.6]}`, `toneMapping: ACESFilmicToneMapping`, `outputColorSpace: SRGBColorSpace`, exposure 1.0.
- Lighting: drei `<Environment preset="studio" />` is **not allowed** (fetches HDR from a CDN). Use a self-hosted small HDR (`/3d/env-studio-1k.hdr`, ≤ 600 KB) or `<Lightformer>` panels: warm key (`#FFE7D1`, intensity 2.5) top-left, cool rim (`#8FE6D6`, 1.2) back-right, soft fill. `<ContactShadows opacity={0.45} blur={2.6} far={1.2} />`.
- Pause the render loop when the tab is hidden or no placeholder is visible (`frameloop="demand"` + `invalidate()` on interaction/animation ticks, or toggle `frameloop`).
- Handle `webglcontextlost` / `restored`; on loss, show fallbacks.

```tsx
// frontend/src/three/SceneCanvas.tsx (skeleton — complete it)
import { Canvas } from "@react-three/fiber";
import { View, ContactShadows } from "@react-three/drei";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";

export default function SceneCanvas() {
  return (
    <Canvas
      className="!fixed inset-0 !pointer-events-none"
      style={{ zIndex: 1 }}
      dpr={[1, 1.6]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => { gl.toneMapping = ACESFilmicToneMapping; gl.outputColorSpace = SRGBColorSpace; }}
      eventSource={document.getElementById("root")!}
    >
      <View.Port />
    </Canvas>
  );
}

// frontend/src/three/ScenePlaceholder.tsx
// Renders a sized div + <View track={ref}> containing <NovaScene variant={scene} />.
// If 3D is disabled (see useCanRender3D), renders <img src={fallbackSrc} alt={alt}> instead.
```

### 7.7 Performance budget for 3D

| Item | Budget |
|---|---|
| 3D JS chunk (three + r3f + drei subset, gzip) | ≤ 220 KB, never in the initial route bundle |
| Model + env assets per page | ≤ 1 MB total |
| Frame time on a mid laptop | ≤ 8 ms; on a 2021 mid Android ≥ 45 fps or auto-degrade |
| Auto-degrade | If average fps < 40 over 3s: drop DPR to 1, disable shadows; if < 25: switch to fallback image |

### 7.8 Fallbacks and when 3D is off
`useCanRender3D()` returns false when: WebGL2 unavailable, `navigator.connection.saveData` is true, `effectiveType` is `2g`/`slow-2g`, device memory < 4 GB (`navigator.deviceMemory`), or the user turned off "Animations" in their profile settings. Under `prefers-reduced-motion: reduce`, 3D may render **static** (one frame, no loop).

Every scene ships fallbacks rendered from the same model: `/3d/fallback/<scene>@1x.webp` and `@2x.webp` (≤ 80 KB each), plus an `alt` text that describes the scene (e.g., "Nova, a white ceramic owl robot with glowing orange eyes, waving hello").

---

## 8. Figma workflow

### 8.1 What Figma is used for (be precise)
Figma is our **source of truth for 2D design**: variables, components, screens and prototypes. Figma is **not** a 3D modelling tool, so the 3D model is built in code (Route A) or Blender (Route B). Figma receives **rendered stills** of Nova and each scene (transparent PNG/WebP at 2×), placed into screens exactly where the live scene will render, so the static design matches the live site.

If the agent has the **Figma MCP** connected:
1. Call `whoami`, then create a file **"SCC — Design System & Screens"** (or use the file URL the team provides).
2. Load the `figma-use` skill before any `use_figma` call; load `figma-generate-library` for variables/components; `figma-generate-design` for screens.
3. Run `search_design_system` before creating any component to avoid duplicates.
4. Upload Nova renders with `upload_assets`.
5. After code exists, keep Figma and code in sync; never let them drift on tokens.

If Figma MCP is not available, produce `ui/design/figma-spec/` markdown + PNG exports, and a teammate rebuilds them in Figma by hand from this file.

### 8.2 Figma file structure

| Page | Contents |
|---|---|
| `00 Cover` | Project name, version, owners, status |
| `01 Foundations` | Variables (all §3 tokens, `dark` mode, `light` stub), type styles, grid styles (4/6/12 col), effect styles (shadow-stack, shadow-pop, glass blur), rails overlay component |
| `02 Signature` | Chamfer, aurora border, corner brackets, eyebrow, spec list, index counter, status pulse, section rail, ruler strip |
| `03 Components` | §6 inventory, each as a component set with variants `variant/size/state`; auto layout everywhere; documented with a description and a11y notes |
| `04 3D` | Nova turnaround (front, 3/4, side, back), every mood from §7.2, every scene from §7.3, fallback stills, material swatches, proportion sheet with numbers |
| `05 Showcase Screens` | Landing, Login, Register, Verify email, Forgot, Reset, Accept invite, MFA verify, MFA setup (3 steps), 404, 500, Offline |
| `06 Workspace Screens` | All §9.2 screens per role, desktop 1440 and mobile 390 |
| `07 States` | Loading, empty, error, permission-denied, locked, rate-limited, session-expired, step-up variants |
| `08 Prototype` | Auth flow: login → MFA → dashboard; error branches; MFA setup flow |
| `99 Handoff` | Redlines for tricky parts (chamfer focus ring, sticky stacked cards, 3D slot sizes per breakpoint) |

Naming: `Button/Primary/M/Hover`, variables `color/bg`, `color/ink-2`, `space/4`. Frames named by route: `/login`, `/dashboard (student)`.

---

## 9. Screens

### 9.1 Showcase screens

**Landing (`/`)** — sections in order:
1. **Announcement strip:** `NEW · Semester resources are live for all departments ↗` (dismissible, remembered in `localStorage` — non-sensitive UI flag only).
2. **Header:** logo (wordmark "campus·companion" + Nova glyph), nav (Features, For faculty, Security, FAQ — mono), right: `Log in` (ghost) and `Get started` (primary aurora).
3. **Hero (160vh sticky track):** eyebrow `● YOUR CAMPUS, IN ONE PLACE`; headline `Know. Find.` / `Act.` with corner brackets on "Act."; sub-copy "Announcements, events, study resources and openings — filtered for your department and year."; CTAs `Get started ↗` and `See how it works`; live spec list (right, mono): `ANNOUNCEMENTS — LIVE`, `RESOURCES — 2,400+`, `OPENINGS — UPDATED DAILY`, `ACCESS — ROLE-BASED` (numbers come from a public stats endpoint or are removed — never hardcode fake stats in production); Nova `hero` scene; scroll cue; aurora progress hairline.
4. **Role tabs (boxed Tabs):** `01 STUDENT · 02 FACULTY · 03 PLACEMENT · 04 ADMIN` → each tab swaps copy and a product screenshot frame.
5. **Everything in one place:** `network` scene + four sticky stacked feature cards (P1 Announcements, P2 Events, P3 Resources, P4 Openings), each with a spec list and a "See it ↗" action.
6. **Security, visibly:** `shield` scene; four mono spec rows: `MFA FOR STAFF`, `SESSIONS YOU CAN SEE & END`, `ROLE CHECKS ON EVERY REQUEST`, `FILES SCANNED BEFORE SHARING`.
7. **Events carousel:** snap carousel of upcoming public events, index counter, arrow buttons (keyboard + swipe).
8. **FAQ:** accessible accordion (`<details>`/`<summary>` styled).
9. **Footer:** big wordmark, links (Privacy, Terms, Accessibility, Contact), `BACK TO TOP ↑`, `© 2026 SMART CAMPUS COMPANION`.

**Auth pages** (split layout on lg: left 5/12 `auth` scene + mono quote panel; right 7/12 form card; mobile: compact Nova head above the form, 120px tall, or fallback image):

| Route | Content and states |
|---|---|
| `/login` | Email, password, `Forgot password?`, primary `Log in`, divider `OR`, `Continue with Google` (college domain hint). States: invalid credentials (generic message, Nova `error`), locked (`Try again in 12 min`, Nova `locked`, show countdown), not verified (resend link), rate-limited, Turnstile challenge slot after 3 failures. |
| `/login/mfa` | `02 / 02` counter, OtpField, "Use a recovery code instead" link, remember-nothing note. Wrong code: shake OtpField (not the page), keep focus. |
| `/register` | Name, college email, roll number, department, year, password (strength + breach message), terms checkbox. On submit always show "Check your inbox" (no account enumeration). |
| `/verify-email` | Loading → success (Nova `success`, "Continue to log in") or expired (resend). |
| `/forgot-password`, `/reset-password` | Same generic-confirmation pattern; reset shows password rules inline and "All your devices will be signed out." |
| `/accept-invite` | For staff: set password, then forced MFA setup. Shows role badge being granted. |
| `/mfa/setup` | 3 steps with index counter: `01 SCAN` (QR + manual key with copy button), `02 CONFIRM` (OtpField), `03 SAVE CODES` (10 recovery codes, Download .txt / Copy, checkbox "I saved these" required to finish). Nova `shield`. |

**System pages:** `404` (Nova `sleep`, "This page took a study break."), `500` ("Something broke on our side. Reference: `req_8f3a…`" — show the request id from the API error), `offline` (PWA).

### 9.2 Workspace screens

| Route | Who | Layout and content |
|---|---|---|
| `/dashboard` | All (role-tailored) | Greeting row (`mini` Nova on lg, "Good morning, Riya" + `CSE · YEAR 3` eyebrow), "For you" feed (mixed announcements + events, newest first, `AudienceBadge`), right column: upcoming events (3), openings closing soon (3, `DeadlineChip`), bookmarks. Faculty: + "Your posts" with reach counts and a `New post` split button. Admin: + KPI tiles (users, posts today, pending moderation, security alerts) in mono-data. |
| `/announcements`, `/announcements/:id` | All | List with filters (department, year, date), detail with spec list (author, audience, posted, expires), bookmark toggle. |
| `/announcements/new`, `/edit` | Faculty, mod, admin | Editor: title, body (plain text/Markdown with live preview, **sanitised rendering**), audience picker (departments × years), schedule publish, expiry. Sticky footer: `Save draft` / `Publish`. "Who can see this" summary always visible. |
| `/events`, `/events/:id` | All / creators | Calendar strip + list, RSVP button with capacity bar, waitlist state, `.ics` download, QR check-in code for RSVP'd users. |
| `/resources` | All | **The key flow:** FilterBar dept → year → sem → subject, results as rows (file type icon, title, subject, uploader, size, date), preview drawer (PDF preview), download (signed URL). Upload button for faculty; students see "Submit for review". Upload modal: drag-drop, type/size validation message (PDF, DOCX, PPTX ≤ 10 MB), progress, "Scanning for viruses…" state, then "Published" or "Waiting for approval". |
| `/openings`, `/openings/:id` | All / placement | Cards with company, type (job/internship), eligibility chips, `DeadlineChip`, "I applied" toggle. External apply opens an interstitial: "You're leaving Campus Companion for `careers.example.com`". |
| `/search` + ⌘K palette | All | Grouped results (Announcements, Events, Resources, Openings), highlight matches, keyboard navigation. |
| `/bookmarks` | All | Tabs by content type, empty state with Nova still. |
| `/me` (Profile) | Own only | Editable: name, phone, bio, avatar. Read-only with lock icon + tooltip: role, department, roll no. |
| `/me/security` | Own | `shield` header (lg), MFA status card (enable/disable — step-up), change password, **active sessions list** (`SessionRow`, revoke, "Sign out of all other devices"), recent security events, download my data, delete account (step-up + type-to-confirm). |
| `/me/settings` | Own | Notifications preferences, Animations toggle (controls 3D + motion), theme (dark now). |
| `/moderation` | Moderator, admin | Queue table: item, type, author, flagged reason, age; preview pane; Approve / Reject with reason; keyboard: `J/K` move, `A` approve, `R` reject (shown in a shortcuts hint). |
| `/admin/users` | Admin | Table: name, email, role badge, department, status, MFA, last login; filters; row actions (change role, suspend/activate) → StepUpDialog → ConfirmDialog. `Invite users` (single + CSV upload with validation report). |
| `/admin/audit` | Admin | Read-only log table, filters (actor, action, date), result chips (success/denied), detail drawer with JSON metadata (rendered as text, never HTML). |
| `/admin/analytics` | Admin | KPI tiles + simple charts (follow the `dataviz` palette rules; no 3D charts). |

### 9.3 Global states (design every one in `07 States`)
`loading` (skeletons matching final layout), `empty`, `error` (with retry and request id), `forbidden` ("You don't have access to this. If you think that's wrong, contact an admin." — never reveal whether the item exists), `session-expired` (modal: "Please log in again", preserves the current URL), `step-up`, `locked`, `rate-limited` ("Too many attempts. Try again in 40s." with countdown), `offline` banner, `MFA-enrollment-required` banner that blocks the workspace until setup.

---

## 10. Motion specification

| Pattern | Spec |
|---|---|
| Hover colour | `--dur-1`, `ease-out` |
| Reveal on scroll | Elements fade + translateY 16px → 0, `--dur-3`, `--ease-out`, stagger 60ms, once, via IntersectionObserver (threshold 0.15) |
| Image zoom on card hover | scale 1 → 1.045, `--dur-4` |
| Sticky stacked cards | Each next card sticks at `top: 88px` with `--shadow-stack`; no JS needed (`position: sticky`) |
| Hero | Headline scales 1 → 0.92 and fades slightly as hero track scrolls (transform-origin bottom-left) |
| Dialog | Backdrop fade `--dur-2`; panel scale .98 → 1 + fade `--dur-2` |
| Toast | Slide from bottom 12px + fade |
| Page transitions | Cross-fade 150ms only; no slide transitions in the workspace |
| Status pulse | 2s infinite opacity .4 ↔ 1 |
| Reduced motion | All of the above become instant opacity changes; 3D renders a single static frame; carousels don't auto-advance (nothing auto-advances anyway) |

Use CSS transitions first; use `motion` (Framer Motion successor) only for dialog/toast presence and shared-layout cases.

---

## 11. Responsive rules
- Design **mobile 390** first, then **1440**; check 360, 768, 1024, 1920.
- Touch targets ≥ 44×44 (WCAG 2.5.8 needs 24, we choose 44).
- Hero on mobile: headline first, Nova below at 60vw (or fallback), spec list hidden behind "Details" toggle.
- Tables → card lists under `md`. Sidebar → drawer + bottom tabs under `lg`.
- No horizontal scroll at any width except intentional carousels; text never truncated without a way to read it (tooltip or detail page).
- Respect safe areas (`env(safe-area-inset-*)`) for the bottom tab bar.

---

## 12. Accessibility checklist (WCAG 2.2 AA — required)
- [ ] Contrast: text 4.5:1, large text and UI parts 3:1, focus ring 3:1 against both bg and component.
- [ ] Every page has one `h1`, logical heading order, landmarks (`header`, `nav`, `main`, `footer`), and a **Skip to content** link.
- [ ] Full keyboard operation; visible focus everywhere (including chamfered elements); no keyboard traps except dialogs (which trap correctly).
- [ ] Forms: visible labels, `autocomplete` attributes (`email`, `current-password`, `new-password`, `one-time-code`, `name`), errors announced (`aria-live`) and linked to fields, error summary at top for long forms.
- [ ] Status never by colour alone (icons + text).
- [ ] 3D canvas is `aria-hidden`; each `ScenePlaceholder` has `role="img"` + descriptive `aria-label`, or is `aria-hidden` if purely decorative.
- [ ] `prefers-reduced-motion` honoured; Animations toggle in settings.
- [ ] Zoom to 200% and text spacing overrides don't break layouts; reflow at 320px.
- [ ] Target size ≥ 24px minimum (we use 44px).
- [ ] Automated: `@axe-core/playwright` on every route in CI, zero serious/critical violations. Manual: keyboard pass + screen reader pass (NVDA on Windows, TalkBack on Android) for login, MFA setup, resources filter/download, admin suspend.

---

## 13. Performance budgets (1 lakh users on mobile networks)

| Metric (p75, mobile 4G, mid Android) | Budget |
|---|---|
| LCP | ≤ 2.5 s (landing hero LCP element is the headline text, not the 3D) |
| INP | ≤ 200 ms |
| CLS | ≤ 0.05 (every ScenePlaceholder has fixed aspect ratio) |
| Initial JS (gzip) per route | ≤ 170 KB (excluding the lazy 3D chunk) |
| CSS (gzip) | ≤ 35 KB |
| Fonts | 2 variable WOFF2 files, `font-display: swap`, preload only Geist |
| Images | AVIF/WebP, `srcset` + `sizes`, `loading="lazy"` below the fold, explicit width/height |

Rules: route-level code splitting; 3D chunk only on showcase routes; no icon fonts (use `lucide-react` tree-shaken); Lighthouse CI budget file (`frontend/lighthouse-budget.json`) fails the build on regressions.

---

## 14. Security rules for the UI layer
- **CSP-compatible:** no inline scripts, no `eval`, no `new Function`; styles via the built CSS file (Tailwind) — avoid runtime style injection libraries. Inline `style` attributes are allowed only for CSS variables/dimensions set from React (the CSP allows `style-src 'self'` plus hashes if needed — coordinate with Backend/DevOps).
- **No third-party origins:** fonts, models, HDRs, images all self-hosted. Google sign-in is a server redirect, not an embedded third-party script. Turnstile is the only allowed third-party widget, loaded only on the login challenge.
- **Never render user content as HTML.** Markdown is rendered with a safe renderer that outputs React elements (no raw HTML), links get `rel="noopener noreferrer nofollow"` and external-link interstitial.
- **Tokens never touch JS storage.** Auth uses httpOnly cookies set by the API; UI reads auth state from `/api/auth/me`. `localStorage` only for non-sensitive UI flags (dismissed banner, sidebar collapsed).
- **Generic errors** in auth UI exactly as the API returns them — do not "improve" messages into ones that reveal whether an account exists.
- **Sensitive inputs:** `autocomplete` correct, no `spellcheck` on passwords/codes, recovery codes shown once with clear "store safely" guidance, mask emails in confirmations (`r***@iem.edu.in`).
- **Clickjacking:** the app must not be framed (header set by server); the UI must not depend on being embedded.
- **External links** in openings go through the interstitial with the destination domain shown in mono.

---

## 15. Implementation guide

### 15.1 Allowed dependencies (ask before adding anything else)
`react`, `react-dom`, `react-router`, `tailwindcss` (v4) + `@tailwindcss/vite`, `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`, `three`, `@react-three/fiber`, `@react-three/drei`, `zustand` (Nova mood store), `motion`, `lucide-react`, `clsx` + `tailwind-merge` (`cn` helper), `qrcode` (MFA QR, rendered locally), dev: `@axe-core/playwright`, `@playwright/test`, `@lhci/cli`, `@gltf-transform/cli`.
Check that `@react-three/fiber`'s React peer range matches the React version in the repo before installing.

### 15.2 Folder layout
```
ui/
  src/
    styles/       tokens.css, signature.css, base.css
    components/   Button.tsx, TextField.tsx, ... (one file per component + index.ts)
    patterns/     FilterBar.tsx, SessionRow.tsx, DeadlineChip.tsx, AudienceBadge.tsx
    lib/          cn.ts, useReducedMotion.ts, useMediaQuery.ts
    index.ts
frontend/src/
  three/          SceneCanvas.tsx, ScenePlaceholder.tsx, nova/ (Nova.tsx, materials.ts, moods.ts, gaze.ts),
                  scenes/ (Hero.tsx, Auth.tsx, Network.tsx, Shield.tsx, Mini.tsx, Sleep.tsx),
                  useCanRender3D.ts, novaStore.ts
  layouts/        ShowcaseLayout.tsx, WorkspaceLayout.tsx, AuthLayout.tsx
  pages/          (visual shells; Frontend agent wires data)
  dev/            ui-gallery.tsx (dev-only)
frontend/public/3d/   nova.opt.glb (Route B), env-studio-1k.hdr, fallback/*.webp
design/
  3d/             nova_build.py (Route B), render_stills.md
  figma-spec/     exports if Figma MCP is unavailable
```

### 15.3 Nova mood store (contract with the Frontend agent)
```ts
// frontend/src/three/novaStore.ts
import { create } from "zustand";
export type NovaMood = "idle" | "greet" | "thinking" | "success" | "error" | "locked" | "shield" | "sleep";
interface NovaState { mood: NovaMood; lookAt: DOMRect | null;
  setMood: (m: NovaMood, revertAfterMs?: number) => void; setLookAt: (r: DOMRect | null) => void; }
export const useNova = create<NovaState>((set) => ({
  mood: "idle", lookAt: null,
  setMood: (mood, revertAfterMs) => {
    set({ mood });
    if (revertAfterMs) setTimeout(() => set((s) => (s.mood === mood ? { mood: "idle" } : s)), revertAfterMs);
  },
  setLookAt: (lookAt) => set({ lookAt }),
}));
```

### 15.4 Capability check
```ts
// frontend/src/three/useCanRender3D.ts
export function canRender3D(userAnimationsOn: boolean): boolean {
  if (!userAnimationsOn || typeof window === "undefined") return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (["slow-2g", "2g"].includes(nav.connection?.effectiveType ?? "")) return false;
  if ((nav.deviceMemory ?? 8) < 4) return false;
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}
```

---

## 16. Contract with Frontend and Backend agents

### 16.1 API error codes → UI states
The API returns `{ code, message, requestId }`. Map codes to UI (Backend agent confirms the final list in `AGENTS.md`):

| Code | UI treatment | Nova mood |
|---|---|---|
| `VALIDATION_ERROR` | Field errors from `issues[]`, error summary | `error` |
| `INVALID_CREDENTIALS` | Generic inline message on the form | `error` |
| `EMAIL_NOT_VERIFIED` | Banner + "Resend link" | `idle` |
| `ACCOUNT_LOCKED` | Countdown, disable submit | `locked` |
| `RATE_LIMITED` | Countdown from `Retry-After` | `locked` |
| `MFA_REQUIRED` | Route to `/login/mfa` | `thinking` |
| `MFA_INVALID` | Shake OtpField, keep focus | `error` |
| `MFA_ENROLLMENT_REQUIRED` | Blocking banner → `/mfa/setup` | `shield` |
| `STEP_UP_REQUIRED` | `StepUpDialog`, then retry the original action | `shield` |
| `SESSION_EXPIRED` / `SESSION_REVOKED` | Session-expired modal, keep return URL | `sleep` |
| `CSRF_INVALID` | Silent refresh of CSRF token and one retry; then generic error | — |
| `FORBIDDEN` | Forbidden state (no existence leak) | `idle` |
| `NOT_FOUND` | 404 state | `sleep` |
| `INTERNAL_ERROR` | Error state with `requestId` and retry | `idle` |

### 16.2 Handoff rules
- You export components from `@scc/ui`; the Frontend agent imports only from there. If a page needs a new visual pattern, add it to `ui` first (and to Figma).
- Roles and permission labels come from `@scc/shared` — do not hardcode role lists in the UI.
- Screenshots (desktop + mobile) of every changed screen go in the PR description, next to the Figma frame link.

---

## 17. Milestones and Definition of Done

| Step | Output | Done when |
|---|---|---|
| U1 Foundations | Figma variables + `tokens.css` + rails | Token names identical in Figma and code; contrast table passes |
| U2 Nova | Model (Route A or B), 8 moods, 6 scenes, fallbacks | Runs ≥ 45 fps on a mid Android; fallbacks render with WebGL disabled; asset budgets met |
| U3 Components | `ui` §6 + Figma component sets | Every component has all states, keyboard support, gallery entry, axe clean |
| U4 Showcase | Landing + auth + system pages | Matches Figma at 390/1440; LCP ≤ 2.5s on throttled mobile; reduced-motion verified |
| U5 Workspace | All §9.2 shells for all roles | Mobile bottom tabs work; tables collapse; every global state designed and implemented |
| U6 Polish | Prototype, handoff page, Lighthouse CI, axe CI | CI green; screen-reader pass done on 4 key flows |

**Definition of Done (every PR):** matches Figma frame · tokens only · all states · keyboard + screen reader checked · reduced motion checked · mobile 360 and desktop 1440 screenshots attached · no new console errors · bundle budgets pass · no third-party requests in the network tab (except Turnstile on challenged login).

---

## 18. Voice and microcopy
- Short, warm, plain English; second person; no exclamation marks in errors.
- Mono labels are terse nouns: `OPENINGS · CLOSING SOON`, `03 / 12`, `SCANNING FILE…`.
- Buttons are verbs: `Publish`, `Download`, `Approve`, `Suspend user`.
- Errors say what happened and what to do: "That code didn't match. Check your authenticator app and try again."
- Security copy reassures without detail leaks: "If an account exists for that email, we've sent a reset link."
- Nova never speaks in the UI (no chatbot bubbles). It reacts; the copy stays professional.

---
*Owner: UI/UX teammate · Version 1.0 · 14 Oct 2026 · Update this file when a design decision changes, and note the change in the PR.*

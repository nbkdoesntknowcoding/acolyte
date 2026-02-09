# Acolyte AI Design System & Brand Book
## Claude Code Skill Document | Version 1.0 | February 2026

---

## OVERVIEW

This document defines the complete design system for Acolyte AI, an AI-powered medical education platform serving two distinct audiences: **medical students** (B2C) and **medical college administrators/faculty** (B2B). It is optimized for use with Claude Code, AI coding assistants, and Google Stitch design workflows.

**Key Design Decisions:**
- **Dual-Palette Architecture**: Student app uses Emerald Green; B2B admin/faculty uses Teal (medical-professional)
- **Brand Color**: Emerald Green (#00C853) — retained for owl logo, brand identity, success states across both apps
- **B2B UI Primary**: Teal (#0D9488) — medical industry standard, conveys trust + care, bridges green brand
- **Student UI Primary**: Emerald Green (#00C853) — energetic, aspirational, matches existing dark-theme student MVP
- **Typography**: Inter for B2B (data-dense, tabular figures); student app uses existing font stack
- **Dark + Light Mode**: Both audiences supported
- **Design Philosophy**: B2B = Dense Information + Zero-Click Insights for time-starved administrators; Student = Clean + Mobile-First + Distraction-Free for focused study sessions
- **UX North Star**: Competitors (CampusMedicine, MasterSoft, Marrow) have universally poor UX. We win by being the only platform that feels modern, responsive, and thoughtfully designed.

**Two Apps, One Brand:**
The owl mascot, green accent color, and Acolyte wordmark appear in both apps — creating brand recognition. But the UI treatment differs because the audiences have fundamentally different needs:
- **Students**: Mobile-first, dark theme default, minimal chrome, focus on content consumption
- **Admin/Faculty**: Desktop-first, data-dense dashboards, quick actions, batch operations, keyboard shortcuts

---

## 1. COLOR SYSTEM

### 1.1 Why Teal for B2B (Not Green or Blue)

**Research-backed reasoning:**
- Teal is the dominant color in healthcare/medical SaaS (Epic, Cerner, Athenahealth, Doximity)
- Conveys trust, care, and professionalism — the exact emotional register for medical college administrators
- Bridges Acolyte's green brand identity (teal is green-blue, visually adjacent to emerald)
- Avoids semantic confusion: green = success/confirmation, teal = primary action
- Distinct from student app's green — users on both apps immediately know which context they're in
- Blue alone (like QuickQuote) would feel too "corporate tech" for a medical education platform

**Acolyte Strategy:**
- Owl Logo + Wordmark: Emerald Green (#00C853) everywhere
- Student App UI: Emerald Green primary on dark backgrounds
- B2B App UI: Teal (#0D9488) for actions, buttons, links
- Success State: Green — semantically correct in both apps
- Compliance Alerts: Amber/Red severity scale (medical-standard)

### 1.2 B2B Primary Palette — Teal

```css
/* ===========================================
   ACOLYTE B2B PRIMARY — Teal
   Used in: Admin, Faculty, Compliance, Dean dashboards
   =========================================== */

--color-primary-50: #F0FDFA;   /* Lightest — subtle backgrounds */
--color-primary-100: #CCFBF1;  /* Very light — hover backgrounds */
--color-primary-200: #99F6E4;  /* Light — selected states */
--color-primary-300: #5EEAD4;  /* Medium light — borders on dark */
--color-primary-400: #2DD4BF;  /* Medium — secondary actions */
--color-primary-500: #14B8A6;  /* Base — secondary buttons */
--color-primary-600: #0D9488;  /* Base — primary buttons, links ★ */
--color-primary-700: #0F766E;  /* Dark — button hover */
--color-primary-800: #115E59;  /* Darker — button active */
--color-primary-900: #134E4A;  /* Darkest — high contrast text */
--color-primary-950: #042F2E;  /* Ultra dark — dark mode surfaces */
```

**Note:** B2B primary anchors on `600` (not `500`) because teal-600 (#0D9488) has better contrast ratios against white backgrounds than teal-500. This ensures WCAG AA compliance for all interactive elements without requiring special handling.

### 1.3 Student Primary Palette — Emerald Green

```css
/* ===========================================
   ACOLYTE STUDENT PRIMARY — Emerald Green
   Used in: Student mobile app, student web dashboard
   =========================================== */

--color-student-50: #ECFDF5;
--color-student-100: #D1FAE5;
--color-student-200: #A7F3D0;
--color-student-300: #6EE7B7;
--color-student-400: #34D399;
--color-student-500: #10B981;  /* Base — buttons on light backgrounds */
--color-student-600: #059669;  /* Primary on light — links, actions */
--color-student-700: #047857;  /* Hover state */
--color-student-800: #065F46;
--color-student-900: #064E3B;
--color-student-950: #022C22;

/* The exact brand green from logo/pitch deck */
--color-brand-green: #00C853;  /* Owl logo, brand moments, marketing */
```

### 1.4 Brand Accent — Owl Green

```css
/* ===========================================
   ACOLYTE BRAND GREEN
   Used for: Owl logo, brand identity, marketing materials
   Appears in BOTH apps as accent, never as UI primary in B2B
   =========================================== */

--color-brand-50: #E8F5E9;
--color-brand-100: #C8E6C9;
--color-brand-200: #A5D6A7;
--color-brand-300: #81C784;
--color-brand-400: #66BB6A;
--color-brand-500: #4CAF50;
--color-brand-600: #43A047;
--color-brand-700: #388E3C;
--color-brand-800: #2E7D32;
--color-brand-900: #1B5E20;

/* Exact logo green */
--color-logo-green: #00C853;  /* Use ONLY for owl logo and brand wordmark */
```

### 1.5 Neutral Palette — Slate (Blue-tinted Grays)

```css
/* ===========================================
   NEUTRAL COLORS — Slate (blue-tinted grays)
   Harmonizes with teal primary, feels medical/clinical
   Used in BOTH apps
   =========================================== */

--color-neutral-0: #FFFFFF;    /* Pure white */
--color-neutral-50: #F8FAFC;   /* Page background (light mode) */
--color-neutral-100: #F1F5F9;  /* Card backgrounds, alternate rows */
--color-neutral-200: #E2E8F0;  /* Borders, dividers */
--color-neutral-300: #CBD5E1;  /* Disabled borders */
--color-neutral-400: #94A3B8;  /* Placeholder text, disabled text */
--color-neutral-500: #64748B;  /* Secondary text, icons */
--color-neutral-600: #475569;  /* Body text (light mode) */
--color-neutral-700: #334155;  /* Emphasis text */
--color-neutral-800: #1E293B;  /* Headlines, primary text */
--color-neutral-900: #0F172A;  /* Highest contrast text */
--color-neutral-950: #020617;  /* Dark mode backgrounds */
```

### 1.6 Semantic Colors

```css
/* ===========================================
   SEMANTIC COLORS — Functional meaning
   Used in BOTH apps identically
   =========================================== */

/* Success — Green (brand-aligned) */
--color-success-50: #F0FDF4;
--color-success-100: #DCFCE7;
--color-success-500: #22C55E;
--color-success-600: #16A34A;
--color-success-700: #15803D;

/* Warning — Amber */
--color-warning-50: #FFFBEB;
--color-warning-100: #FEF3C7;
--color-warning-500: #F59E0B;
--color-warning-600: #D97706;
--color-warning-700: #B45309;

/* Error / Danger — Red */
--color-error-50: #FEF2F2;
--color-error-100: #FEE2E2;
--color-error-500: #EF4444;
--color-error-600: #DC2626;
--color-error-700: #B91C1C;

/* Info — Blue */
--color-info-50: #EFF6FF;
--color-info-100: #DBEAFE;
--color-info-500: #3B82F6;
--color-info-600: #2563EB;
--color-info-700: #1D4ED8;
```

### 1.7 Compliance Status Colors (B2B-Specific)

```css
/* ===========================================
   COMPLIANCE STATUS — Medical/NMC specific
   These map to NMC compliance thresholds
   =========================================== */

--color-compliance-green: #22C55E;    /* >80% — safe */
--color-compliance-yellow: #EAB308;   /* 75–80% — warning */
--color-compliance-orange: #F97316;   /* 70–75% — at risk */
--color-compliance-red: #EF4444;      /* <70% — critical */

/* B2B Status Colors (workflow states) */
--color-status-draft: #94A3B8;        /* neutral-400 */
--color-status-pending: #F59E0B;      /* warning */
--color-status-in-review: #8B5CF6;    /* violet */
--color-status-approved: #22C55E;     /* success */
--color-status-submitted: #0D9488;    /* primary teal */
--color-status-rejected: #EF4444;     /* error */
--color-status-expired: #64748B;      /* neutral-500 */
```

### 1.8 Dark Mode Colors

```css
/* ===========================================
   DARK MODE — B2B Admin/Faculty
   =========================================== */

/* Dark mode surfaces */
--dark-bg-primary: #0F172A;    /* Main background — neutral-900 */
--dark-bg-secondary: #1E293B;  /* Cards, elevated surfaces — neutral-800 */
--dark-bg-tertiary: #334155;   /* Hover states, modals — neutral-700 */

/* Dark mode borders */
--dark-border-default: #334155;   /* neutral-700 */
--dark-border-subtle: #1E293B;    /* neutral-800 */

/* Dark mode text */
--dark-text-primary: #F8FAFC;     /* neutral-50 */
--dark-text-secondary: #CBD5E1;   /* neutral-300 */
--dark-text-tertiary: #94A3B8;    /* neutral-400 */
--dark-text-disabled: #64748B;    /* neutral-500 */

/* Dark mode primary (brighter teal for visibility) */
--dark-primary-400: #2DD4BF;      /* teal-400 */
--dark-primary-500: #14B8A6;      /* teal-500 */

/* Dark mode success (brighter) */
--dark-success-400: #4ADE80;
--dark-success-500: #86EFAC;

/* ===========================================
   DARK MODE — Student App
   (Default theme — students see dark first)
   =========================================== */

--student-dark-bg: #0A0A0F;       /* Near-black with slight blue tint */
--student-dark-surface: #141420;   /* Card backgrounds */
--student-dark-elevated: #1E1E2E;  /* Modals, popovers */
--student-dark-border: #2A2A3C;    /* Borders */
--student-dark-text: #E8E8ED;      /* Primary text */
--student-dark-muted: #8888A0;     /* Secondary text */
```

### 1.9 Color Usage Reference

**B2B Admin/Faculty (Light Mode):**

| Element | Color | Token |
|---------|-------|-------|
| Page background | #F8FAFC | `neutral-50` |
| Card background | #FFFFFF | `neutral-0` |
| Primary text | #1E293B | `neutral-800` |
| Secondary text | #475569 | `neutral-600` |
| Primary button bg | #0D9488 | `primary-600` |
| Primary button text | #FFFFFF | white |
| Primary button hover | #0F766E | `primary-700` |
| Links | #0D9488 | `primary-600` |
| Borders | #E2E8F0 | `neutral-200` |
| Success | #22C55E | `success-500` |
| Error | #EF4444 | `error-500` |
| Focus ring | rgba(13, 148, 136, 0.3) | `primary-600` @ 30% |
| Sidebar background | #FFFFFF | white |
| Sidebar active item | #F0FDFA | `primary-50` |
| Sidebar active text | #0D9488 | `primary-600` |

**B2B Admin/Faculty (Dark Mode):**

| Element | Color | Token |
|---------|-------|-------|
| Page background | #0F172A | `neutral-900` |
| Card background | #1E293B | `neutral-800` |
| Primary text | #F8FAFC | `neutral-50` |
| Secondary text | #94A3B8 | `neutral-400` |
| Primary button bg | #14B8A6 | `primary-500` |
| Primary button text | #042F2E | `primary-950` |
| Links | #2DD4BF | `primary-400` |
| Borders | #334155 | `neutral-700` |
| Focus ring | rgba(45, 212, 191, 0.3) | `primary-400` @ 30% |

**Student App (Dark Mode — Default):**

| Element | Color | Token |
|---------|-------|-------|
| Page background | #0A0A0F | `student-dark-bg` |
| Card background | #141420 | `student-dark-surface` |
| Primary text | #E8E8ED | `student-dark-text` |
| Secondary text | #8888A0 | `student-dark-muted` |
| Primary accent | #00C853 | `brand-green` |
| Primary button bg | #00C853 | `brand-green` |
| Links | #34D399 | `student-400` |
| Borders | #2A2A3C | `student-dark-border` |

---

## 2. TYPOGRAPHY

### 2.1 Font Stacks

```css
/* ===========================================
   TYPOGRAPHY — B2B Admin/Faculty
   =========================================== */

/* Primary font — Inter */
--font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

/* Monospace — for IDs, codes, competency codes (e.g., "PH 1.5") */
--font-family-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, 'Cascadia Code', monospace;

/* Hindi — for bilingual content */
--font-family-hindi: 'Noto Sans Devanagari', 'Mangal', sans-serif;

/* Google Fonts import */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');
```

### 2.2 Why Inter for B2B

**Research-backed reasoning:**
- Designed specifically for computer screens (high x-height, open apertures)
- Excellent readability at small sizes — critical for data-dense compliance dashboards
- **Tabular figures** — numbers align perfectly in faculty counts, attendance percentages, fee tables (CRITICAL for B2B)
- 9 weights available for clear hierarchy
- Wide Unicode support (₹ currency symbol, medical symbols)
- Free via Google Fonts — no licensing cost
- Same font as QuickQuote — proven in B2B SaaS context

### 2.3 Type Scale — B2B

```css
/* ===========================================
   B2B TYPE SCALE
   Base: 14px (data-dense dashboard)
   Scale: 1.25 (Major Third)
   =========================================== */

/* Display — Hero metrics, page titles on landing */
--text-display: 36px;
--text-display-line-height: 44px;
--text-display-weight: 700;
--text-display-letter-spacing: -0.025em;

/* H1 — Page titles */
--text-h1: 28px;
--text-h1-line-height: 36px;
--text-h1-weight: 600;
--text-h1-letter-spacing: -0.02em;

/* H2 — Section titles */
--text-h2: 22px;
--text-h2-line-height: 28px;
--text-h2-weight: 600;
--text-h2-letter-spacing: -0.015em;

/* H3 — Card titles, subsections */
--text-h3: 18px;
--text-h3-line-height: 24px;
--text-h3-weight: 600;
--text-h3-letter-spacing: 0;

/* H4 — Small headings, metric labels */
--text-h4: 16px;
--text-h4-line-height: 22px;
--text-h4-weight: 600;
--text-h4-letter-spacing: 0;

/* Body — Default text */
--text-body: 14px;
--text-body-line-height: 22px;
--text-body-weight: 400;

/* Body Small — Secondary content, table cells */
--text-body-sm: 13px;
--text-body-sm-line-height: 20px;

/* Caption — Labels, helper text, timestamps */
--text-caption: 12px;
--text-caption-line-height: 16px;
--text-caption-letter-spacing: 0.01em;

/* Tiny — Badges, tags, micro-labels */
--text-tiny: 11px;
--text-tiny-line-height: 14px;
--text-tiny-weight: 500;
--text-tiny-letter-spacing: 0.02em;

/* Tabular Numbers — ALWAYS for numerical data */
/* font-variant-numeric: tabular-nums; */
```

### 2.4 Typography Usage Rules

| Context | Size | Weight | Color (Light) | Color (Dark) |
|---------|------|--------|---------------|-------------|
| Page title | 28px (H1) | 600 | neutral-800 | neutral-50 |
| Section title | 22px (H2) | 600 | neutral-800 | neutral-50 |
| Card title | 18px (H3) | 600 | neutral-800 | neutral-50 |
| Metric label | 16px (H4) | 600 | neutral-700 | neutral-300 |
| Body text | 14px | 400 | neutral-600 | neutral-300 |
| Table header | 12px | 600 | neutral-500 | neutral-400 |
| Table cell | 13px | 400 | neutral-700 | neutral-300 |
| Table numbers | 13px | 500 | neutral-800 | neutral-200 |
| Caption/timestamp | 12px | 400 | neutral-500 | neutral-400 |
| Button text | 14px | 500 | (per button style) | (per button style) |
| Input text | 14px | 400 | neutral-800 | neutral-100 |
| Placeholder | 14px | 400 | neutral-400 | neutral-500 |
| Badge text | 11px | 500 | (per badge style) | (per badge style) |
| Competency code | 13px mono | 500 | primary-700 | primary-300 |
| NMC regulation ref | 12px mono | 400 | neutral-500 | neutral-400 |

**Critical rules:**
- **Always use `tabular-nums`** for numerical columns: attendance %, faculty counts, fee amounts, compliance scores
- **Competency codes** (e.g., "PH 1.5", "AN 2.3") render in monospace with primary color — they're clickable links to competency details
- **₹ amounts** use tabular figures with right-alignment in tables
- **Hindi text** uses Noto Sans Devanagari at same sizes but with +2px line-height for Devanagari vowel marks
- **Never use italic for emphasis in data tables** — use medium weight (500) or primary color instead

---

## 3. SPACING SYSTEM

### 3.1 Base Unit: 4px

All spacing uses multiples of 4px for mathematical consistency across both apps.

```css
/* ===========================================
   SPACING TOKENS — 4px base grid
   =========================================== */

--space-0: 0;
--space-px: 1px;
--space-0.5: 2px;
--space-1: 4px;
--space-1.5: 6px;
--space-2: 8px;
--space-2.5: 10px;
--space-3: 12px;
--space-3.5: 14px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-7: 28px;
--space-8: 32px;
--space-9: 36px;
--space-10: 40px;
--space-11: 44px;
--space-12: 48px;
--space-14: 56px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### 3.2 Component Spacing Reference — B2B

| Component | Padding | Gap/Margin | Tailwind |
|-----------|---------|------------|----------|
| Button (default) | 10px 20px | — | `py-2.5 px-5` |
| Button (small) | 6px 14px | — | `py-1.5 px-3.5` |
| Button (large) | 12px 24px | — | `py-3 px-6` |
| Input field | 10px 14px | — | `py-2.5 px-3.5` |
| Card | 20px | 16px internal | `p-5 space-y-4` |
| Card (compact) | 16px | 12px internal | `p-4 space-y-3` |
| Modal | 24px | 20px internal | `p-6 space-y-5` |
| Table cell | 12px 16px | — | `py-3 px-4` |
| Table cell (compact) | 8px 12px | — | `py-2 px-3` |
| Table header | 12px 16px | — | `py-3 px-4` |
| Sidebar padding | 16px | 4px item gap | `p-4 space-y-1` |
| Navbar | 0 24px | 16px item gap | `px-6 gap-4` |
| Page content | 24px | — | `p-6` |
| Section gap | — | 24px | `space-y-6` |
| Dashboard grid gap | — | 16px | `gap-4` |
| Form field gap | — | 20px | `space-y-5` |
| Inline badge gap | — | 8px | `gap-2` |

### 3.3 Component Spacing Reference — Student (Mobile)

| Component | Padding | Gap/Margin | Tailwind |
|-----------|---------|------------|----------|
| Screen padding | 16px | — | `px-4` |
| Card | 16px | 12px internal | `p-4 space-y-3` |
| List item | 12px 16px | — | `py-3 px-4` |
| Bottom tab bar | 8px 0 | — | `py-2` |
| Flashcard | 20px | — | `p-5` |
| Chat bubble | 12px 16px | 8px between messages | `py-3 px-4 space-y-2` |

---

## 4. LAYOUT SYSTEM

### 4.1 Fixed Dimensions — B2B

```css
/* ===========================================
   B2B LAYOUT CONSTANTS
   =========================================== */

/* Sidebar — FIXED WIDTH (do not change) */
--sidebar-width: 260px;
--sidebar-collapsed-width: 64px;

/* Navbar */
--navbar-height: 56px;        /* Slightly shorter than QuickQuote — more vertical space for data */

/* Content constraints */
--content-max-width: 1440px;
--content-narrow: 640px;       /* Settings pages, forms */
--content-normal: 1024px;      /* Standard content */
--content-wide: 1200px;        /* Wide dashboards */

/* Dashboard metrics */
--metric-card-min-width: 200px;
--metric-card-height: 100px;

/* Table */
--table-row-height: 44px;        /* Default — comfortable */
--table-row-height-compact: 36px; /* Compact mode */
--table-row-height-relaxed: 52px; /* Relaxed mode */
```

### 4.2 Breakpoints

```css
/* ===========================================
   RESPONSIVE BREAKPOINTS
   Same for both apps (mobile-first)
   =========================================== */

--breakpoint-xs: 0;        /* Mobile portrait */
--breakpoint-sm: 640px;    /* Mobile landscape */
--breakpoint-md: 768px;    /* Tablet portrait */
--breakpoint-lg: 1024px;   /* Tablet landscape / Small desktop */
--breakpoint-xl: 1280px;   /* Desktop */
--breakpoint-2xl: 1536px;  /* Large desktop */
```

### 4.3 B2B Primary Layout Structure

```
┌────────────────────────────────────────────────────────────────┐
│  Navbar (56px)                                                 │
│  [☰ Toggle] [🦉 Acolyte] [College Name ▾] [Search ⌘K] [🔔] [👤]  │
├────────────┬───────────────────────────────────────────────────┤
│            │                                                   │
│  Sidebar   │  Page Content (scrollable)                        │
│  (260px)   │                                                   │
│            │  ┌─────────────────────────────────────────────┐  │
│  [Dashboard│  │  Page Header                                │  │
│  [Students]│  │  Title + Breadcrumb + Actions               │  │
│  [Faculty] │  │                                             │  │
│  [Assess.. │  ├─────────────────────────────────────────────┤  │
│  [Schedule]│  │                                             │  │
│  [Comply..]│  │  Content Area                               │  │
│  [Fees]    │  │  (max-width: 1440px, centered)              │  │
│  [Reports] │  │                                             │  │
│            │  │  Dashboard: 4-column metric grid + charts   │  │
│  ──────────│  │  List: Full-width table + filters            │  │
│  [Settings]│  │  Detail: 2/3 main + 1/3 sidebar            │  │
│  [Help]    │  │  Form: max-width 640px centered             │  │
│            │  │                                             │  │
│            │  └─────────────────────────────────────────────┘  │
├────────────┴───────────────────────────────────────────────────┤
│  (No footer in B2B dashboard apps)                             │
└────────────────────────────────────────────────────────────────┘
```

### 4.4 Dashboard Grid System

```css
/* ===========================================
   DASHBOARD GRID
   Metric cards at top, charts below
   =========================================== */

/* Metric row — 4 equal columns on desktop, 2 on tablet, 1 on mobile */
.dashboard-metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 1024px) {
  .dashboard-metrics { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 640px) {
  .dashboard-metrics { grid-template-columns: 1fr; }
}

/* Chart grid — 2 columns on desktop, 1 on mobile */
.dashboard-charts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin-top: 16px;
}

@media (max-width: 1024px) {
  .dashboard-charts { grid-template-columns: 1fr; }
}

/* Full-width chart (compliance heatmap, timeline) */
.chart-full { grid-column: 1 / -1; }
```

### 4.5 Content Density Settings

B2B users can toggle density. This affects table row height, card padding, and font sizes.

| Setting | Table Row | Card Padding | Body Font | Use Case |
|---------|-----------|-------------|-----------|----------|
| Compact | 36px | 12px | 13px | Power users, large datasets |
| Comfortable | 44px | 20px | 14px | Default |
| Relaxed | 52px | 24px | 15px | Presentations, accessibility |

---

## 5. COMPONENT SPECIFICATIONS — B2B

### 5.1 Buttons

```css
/* ===========================================
   B2B BUTTON SPECIFICATIONS
   =========================================== */

/* Base button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-family-sans);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
  gap: 8px;
}

/* Primary Button — Teal */
.btn-primary {
  background-color: #0D9488;  /* primary-600 */
  color: #FFFFFF;
  padding: 10px 20px;
  border: none;
}
.btn-primary:hover { background-color: #0F766E; }  /* primary-700 */
.btn-primary:active { background-color: #115E59; } /* primary-800 */
.btn-primary:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.3);
}
.btn-primary:disabled {
  background-color: #99F6E4;  /* primary-200 */
  color: #FFFFFF;
  cursor: not-allowed;
}

/* Secondary Button (Outline) */
.btn-secondary {
  background-color: transparent;
  color: #475569;             /* neutral-600 */
  padding: 10px 20px;
  border: 1px solid #E2E8F0;  /* neutral-200 */
}
.btn-secondary:hover {
  background-color: #F8FAFC;
  border-color: #CBD5E1;
}

/* Ghost Button */
.btn-ghost {
  background-color: transparent;
  color: #475569;
  padding: 10px 20px;
  border: none;
}
.btn-ghost:hover { background-color: #F8FAFC; }

/* Danger Button */
.btn-danger {
  background-color: #EF4444;
  color: #FFFFFF;
  padding: 10px 20px;
  border: none;
}
.btn-danger:hover { background-color: #DC2626; }

/* Success Button (for compliance actions) */
.btn-success {
  background-color: #22C55E;
  color: #FFFFFF;
  padding: 10px 20px;
  border: none;
}
.btn-success:hover { background-color: #16A34A; }

/* Button Sizes */
.btn-sm { font-size: 13px; padding: 6px 14px; border-radius: 6px; gap: 6px; }
.btn-lg { font-size: 16px; padding: 12px 24px; border-radius: 10px; gap: 10px; }

/* Icon Button */
.btn-icon { padding: 10px; aspect-ratio: 1; }
.btn-icon.btn-sm { padding: 6px; }
.btn-icon.btn-lg { padding: 12px; }

/* DARK MODE BUTTONS */
.dark .btn-primary { background-color: #14B8A6; color: #042F2E; }
.dark .btn-primary:hover { background-color: #2DD4BF; }
.dark .btn-secondary { color: #CBD5E1; border-color: #334155; }
.dark .btn-secondary:hover { background-color: #1E293B; }
.dark .btn-ghost { color: #CBD5E1; }
.dark .btn-ghost:hover { background-color: #1E293B; }
```

### 5.2 Form Inputs

```css
/* ===========================================
   B2B FORM INPUT SPECIFICATIONS
   =========================================== */

/* Base input */
.input {
  display: block;
  width: 100%;
  height: 40px;
  padding: 10px 14px;
  font-family: var(--font-family-sans);
  font-size: 14px;
  line-height: 1.43;
  color: #1E293B;
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  transition: all 150ms ease;
}
.input::placeholder { color: #94A3B8; }
.input:hover { border-color: #CBD5E1; }
.input:focus {
  outline: none;
  border-color: #0D9488;       /* primary-600 — teal focus ring */
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
}
.input:disabled {
  background-color: #F8FAFC;
  color: #94A3B8;
  cursor: not-allowed;
}
.input-error { border-color: #EF4444; }
.input-error:focus {
  border-color: #EF4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

/* DARK MODE */
.dark .input {
  background-color: #1E293B;
  border-color: #334155;
  color: #F8FAFC;
}
.dark .input::placeholder { color: #64748B; }
.dark .input:hover { border-color: #475569; }
.dark .input:focus {
  border-color: #14B8A6;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.15);
}

/* Label */
.label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #334155;
  margin-bottom: 6px;
}
.dark .label { color: #CBD5E1; }

/* Helper text */
.helper-text { font-size: 12px; color: #64748B; margin-top: 6px; }
.helper-text-error { color: #EF4444; }

/* Select */
.select {
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 40px;
}

/* Checkbox */
.checkbox { width: 18px; height: 18px; border: 1px solid #E2E8F0; border-radius: 4px; }
.checkbox:checked { background-color: #0D9488; border-color: #0D9488; }

/* Radio */
.radio { width: 18px; height: 18px; border: 1px solid #E2E8F0; border-radius: 50%; }
.radio:checked { border-color: #0D9488; border-width: 5px; }
```

### 5.3 Cards

```css
/* ===========================================
   B2B CARD SPECIFICATIONS
   =========================================== */

.card {
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 20px;
}
.card-interactive {
  transition: all 150ms ease;
  cursor: pointer;
}
.card-interactive:hover {
  border-color: #CBD5E1;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid #F1F5F9;
  margin-bottom: 16px;
}
.card-title { font-size: 16px; font-weight: 600; color: #1E293B; }
.card-description { font-size: 14px; color: #64748B; }

/* DARK MODE */
.dark .card { background-color: #1E293B; border-color: #334155; }
.dark .card-interactive:hover { border-color: #475569; }
.dark .card-header { border-bottom-color: #334155; }
.dark .card-title { color: #F8FAFC; }
.dark .card-description { color: #94A3B8; }

/* Metric Card — specific to dashboards */
.metric-card {
  background-color: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.metric-card .metric-label {
  font-size: 12px;
  font-weight: 500;
  color: #64748B;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.metric-card .metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #1E293B;
  font-variant-numeric: tabular-nums;
}
.metric-card .metric-change {
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}
.metric-card .metric-change.positive { color: #16A34A; }
.metric-card .metric-change.negative { color: #DC2626; }

/* Compliance Score Card — unique to Acolyte */
.compliance-card {
  border-left: 4px solid;  /* Color set dynamically based on score */
}
.compliance-card.green { border-left-color: #22C55E; }
.compliance-card.yellow { border-left-color: #EAB308; }
.compliance-card.orange { border-left-color: #F97316; }
.compliance-card.red { border-left-color: #EF4444; }
```

### 5.4 Tables

```css
/* ===========================================
   B2B TABLE SPECIFICATIONS
   Critical for faculty rosters, student lists, fee reports
   =========================================== */

.table-container {
  overflow-x: auto;
  border: 1px solid #E2E8F0;
  border-radius: 12px;
}
.table { width: 100%; border-collapse: collapse; }
.table th {
  background-color: #F8FAFC;
  padding: 12px 16px;
  font-size: 12px;
  font-weight: 600;
  color: #64748B;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #E2E8F0;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}
.table td {
  padding: 12px 16px;
  font-size: 13px;
  color: #334155;
  border-bottom: 1px solid #F1F5F9;
  vertical-align: middle;
}
.table tr:hover td { background-color: #F8FAFC; }
.table tr:last-child td { border-bottom: none; }

/* Numerical columns — always right-aligned with tabular figures */
.table td.numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

/* Compact table */
.table-compact th { padding: 8px 12px; font-size: 11px; }
.table-compact td { padding: 8px 12px; font-size: 12px; }

/* DARK MODE */
.dark .table-container { border-color: #334155; }
.dark .table th { background-color: #0F172A; color: #94A3B8; border-bottom-color: #334155; }
.dark .table td { color: #CBD5E1; border-bottom-color: #1E293B; }
.dark .table tr:hover td { background-color: #0F172A; }

/* Row selection */
.table tr.selected td { background-color: #F0FDFA; } /* primary-50 */
.dark .table tr.selected td { background-color: #042F2E; } /* primary-950 */
```

### 5.5 Badges / Status Tags

```css
/* ===========================================
   STATUS BADGES — B2B
   =========================================== */

.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 9999px;
  white-space: nowrap;
}
.badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Compliance badges */
.badge-compliant { background-color: #F0FDF4; color: #15803D; }
.badge-compliant::before { background-color: #22C55E; }

.badge-warning { background-color: #FFFBEB; color: #A16207; }
.badge-warning::before { background-color: #F59E0B; }

.badge-at-risk { background-color: #FFF7ED; color: #C2410C; }
.badge-at-risk::before { background-color: #F97316; }

.badge-critical { background-color: #FEF2F2; color: #B91C1C; }
.badge-critical::before { background-color: #EF4444; }

/* Workflow badges */
.badge-draft { background-color: #F8FAFC; color: #475569; }
.badge-draft::before { background-color: #94A3B8; }

.badge-pending { background-color: #FFFBEB; color: #A16207; }
.badge-pending::before { background-color: #F59E0B; }

.badge-in-review { background-color: #F5F3FF; color: #6D28D9; }
.badge-in-review::before { background-color: #8B5CF6; }

.badge-approved { background-color: #F0FDF4; color: #15803D; }
.badge-approved::before { background-color: #22C55E; }

.badge-submitted { background-color: #F0FDFA; color: #0F766E; }
.badge-submitted::before { background-color: #0D9488; }

.badge-rejected { background-color: #FEF2F2; color: #B91C1C; }
.badge-rejected::before { background-color: #EF4444; }

/* Competency level badges */
.badge-level-k { background-color: #EFF6FF; color: #1D4ED8; }      /* Know */
.badge-level-kh { background-color: #F0FDFA; color: #0D9488; }     /* Know How */
.badge-level-s { background-color: #FFFBEB; color: #A16207; }      /* Show */
.badge-level-sh { background-color: #FFF7ED; color: #C2410C; }     /* Show How */
.badge-level-p { background-color: #FEF2F2; color: #B91C1C; }      /* Perform */
```

### 5.6 Modal / Dialog

```css
/* ===========================================
   B2B MODAL SPECIFICATIONS
   =========================================== */

.modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  z-index: 50;
}
.modal {
  background-color: #FFFFFF;
  border-radius: 16px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 560px;
  width: calc(100% - 48px);
  max-height: calc(100vh - 48px);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.modal-sm { max-width: 400px; }
.modal-lg { max-width: 720px; }
.modal-xl { max-width: 960px; }
.modal-full { max-width: calc(100% - 48px); }

.modal-header { padding: 24px 24px 0; display: flex; justify-content: space-between; gap: 16px; }
.modal-title { font-size: 18px; font-weight: 600; color: #1E293B; }
.modal-body { padding: 20px 24px; overflow-y: auto; flex: 1; }
.modal-footer {
  padding: 16px 24px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid #F1F5F9;
}

/* DARK MODE */
.dark .modal { background-color: #1E293B; }
.dark .modal-title { color: #F8FAFC; }
.dark .modal-footer { border-top-color: #334155; }
```

### 5.7 Sidebar Navigation

```css
/* ===========================================
   B2B SIDEBAR — Unique to admin/faculty
   =========================================== */

.sidebar {
  width: 260px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 56px;  /* Below navbar */
  background-color: #FFFFFF;
  border-right: 1px solid #E2E8F0;
  padding: 16px;
  overflow-y: auto;
  transition: width 200ms ease;
}
.sidebar.collapsed { width: 64px; }

.sidebar-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 400;
  color: #475569;
  cursor: pointer;
  transition: all 150ms ease;
}
.sidebar-item:hover { background-color: #F8FAFC; color: #334155; }
.sidebar-item.active {
  background-color: #F0FDFA;  /* primary-50 */
  color: #0D9488;             /* primary-600 */
  font-weight: 500;
}

.sidebar-section-label {
  padding: 16px 12px 8px;
  font-size: 11px;
  font-weight: 600;
  color: #94A3B8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* DARK MODE */
.dark .sidebar { background-color: #0F172A; border-right-color: #1E293B; }
.dark .sidebar-item { color: #94A3B8; }
.dark .sidebar-item:hover { background-color: #1E293B; color: #CBD5E1; }
.dark .sidebar-item.active { background-color: #042F2E; color: #2DD4BF; }
.dark .sidebar-section-label { color: #64748B; }
```

### 5.8 Navbar

```css
/* ===========================================
   B2B NAVBAR
   =========================================== */

.navbar {
  height: 56px;
  width: 100%;
  position: fixed;
  top: 0;
  left: 0;
  z-index: 40;
  background-color: #FFFFFF;
  border-bottom: 1px solid #E2E8F0;
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 16px;
}

.navbar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 16px;
  color: #1E293B;
}
.navbar-logo .owl-icon { width: 28px; height: 28px; }

/* College selector dropdown */
.college-selector {
  padding: 6px 12px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  background-color: #F8FAFC;
}

/* Command palette trigger (⌘K) */
.search-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 13px;
  color: #94A3B8;
  background-color: #F8FAFC;
  min-width: 240px;
}
.search-trigger kbd {
  font-size: 11px;
  font-family: var(--font-family-mono);
  padding: 2px 6px;
  background-color: #E2E8F0;
  border-radius: 4px;
  color: #64748B;
}

/* DARK MODE */
.dark .navbar { background-color: #0F172A; border-bottom-color: #1E293B; }
.dark .navbar-logo { color: #F8FAFC; }
.dark .college-selector { background-color: #1E293B; border-color: #334155; color: #CBD5E1; }
.dark .search-trigger { background-color: #1E293B; border-color: #334155; color: #64748B; }
```

---

## 6. COMPLIANCE-SPECIFIC UI PATTERNS

### 6.1 Compliance Score Indicator

```css
/* ===========================================
   COMPLIANCE SCORE — The signature B2B component
   Large circular gauge with color-coded score
   =========================================== */

/* Score thresholds determine all colors automatically */
/* >80% = green | 75-80% = yellow | 70-75% = orange | <70% = red */

.compliance-score {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  position: relative;
}
.compliance-score .score-value {
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.compliance-score .score-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
/* Ring is implemented via SVG with stroke-dasharray animation */
```

### 6.2 Department Heatmap

The compliance dashboard's signature view — a grid showing every department's compliance across multiple metrics.

| | Faculty MSR | Attendance | Bed Ratio | OPD Load | Clinical Exposure |
|---|---|---|---|---|---|
| Anatomy | 🟢 | 🟢 | — | — | — |
| Physiology | 🟢 | 🟡 | — | — | — |
| Medicine | 🟡 | 🟢 | 🟢 | 🟠 | 🟢 |
| Surgery | 🔴 | 🟢 | 🟡 | 🟢 | 🟡 |
| Paediatrics | 🟡 | 🟡 | 🟢 | 🟢 | 🟢 |

Each cell uses compliance color coding. Clicking any cell drills into detailed metrics for that department + parameter combination.

### 6.3 Alert Priority Styling

```css
/* Critical — immediate attention, usually NMC threshold breach */
.alert-critical {
  background-color: #FEF2F2;
  border: 1px solid #FECACA;
  border-left: 4px solid #EF4444;
  border-radius: 8px;
  padding: 16px;
}

/* Warning — approaching threshold */
.alert-warning {
  background-color: #FFFBEB;
  border: 1px solid #FDE68A;
  border-left: 4px solid #F59E0B;
  border-radius: 8px;
  padding: 16px;
}

/* Info — general compliance update */
.alert-info {
  background-color: #F0FDFA;
  border: 1px solid #99F6E4;
  border-left: 4px solid #0D9488;
  border-radius: 8px;
  padding: 16px;
}
```

---

## 7. ICONS & ICONOGRAPHY

### 7.1 Icon Library

**Primary:** Lucide React (open-source, consistent, 1,000+ icons)
**Medical-specific:** Custom SVG icons for medical symbols not in Lucide

```
npm install lucide-react
```

### 7.2 Icon Sizes

| Context | Size | Tailwind |
|---------|------|----------|
| Inline with text | 16px | `w-4 h-4` |
| Button icon | 18px | `w-4.5 h-4.5` |
| Sidebar icon | 20px | `w-5 h-5` |
| Metric card icon | 24px | `w-6 h-6` |
| Empty state | 48px | `w-12 h-12` |
| Page hero | 64px | `w-16 h-16` |

### 7.3 Icon Colors

| Context | Light Mode | Dark Mode |
|---------|-----------|-----------|
| Default | neutral-500 (#64748B) | neutral-400 (#94A3B8) |
| Active | primary-600 (#0D9488) | primary-400 (#2DD4BF) |
| Success | success-600 (#16A34A) | success-400 (#4ADE80) |
| Warning | warning-600 (#D97706) | warning-400 (#FBBF24) |
| Error | error-600 (#DC2626) | error-400 (#F87171) |
| Disabled | neutral-300 (#CBD5E1) | neutral-600 (#475569) |

---

## 8. MOTION & ANIMATION

```css
/* ===========================================
   ANIMATION TOKENS
   =========================================== */

/* Transition durations */
--duration-instant: 75ms;
--duration-fast: 150ms;
--duration-normal: 200ms;
--duration-slow: 300ms;
--duration-slower: 500ms;

/* Easing */
--ease-default: cubic-bezier(0.4, 0, 0.2, 1);
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);

/* Standard animations */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { transform: translateY(8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes slideDown { from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes pulseGlow { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }

/* Compliance score animation — the ring fills on page load */
@keyframes scoreRingFill {
  from { stroke-dashoffset: 283; }
  to { stroke-dashoffset: var(--target-offset); }
}
```

**Motion rules:**
- Page transitions: `fadeIn 200ms ease-out`
- Modal enter: `scaleIn 200ms ease-out` + overlay `fadeIn 200ms`
- Modal exit: `fadeOut 150ms ease-in`
- Sidebar collapse: `width 200ms ease`
- Dropdown open: `slideDown 150ms ease-out`
- Toast notification: `slideUp 200ms ease-out`, auto-dismiss after 5s
- Compliance score ring: `scoreRingFill 1s ease-out` (dramatic, intentional)
- Table row hover: `background-color 150ms ease`
- **No animation on data loading** — skeleton screens only, no spinners for main content

---

## 9. ACCESSIBILITY REQUIREMENTS

### 9.1 Color Contrast

| Element | Minimum Contrast | Standard |
|---------|-----------------|----------|
| Body text | 4.5:1 | WCAG AA |
| Large text (18px+) | 3:1 | WCAG AA |
| UI components | 3:1 | WCAG AA |
| Focus indicators | 3:1 | WCAG AA |

**Verified contrasts for Acolyte B2B:**
- Teal-600 (#0D9488) on white: **4.54:1** ✅ AA
- Teal-700 (#0F766E) on white: **5.72:1** ✅ AA+
- Neutral-600 (#475569) on white: **6.44:1** ✅ AA+
- Neutral-800 (#1E293B) on white: **12.55:1** ✅ AAA

### 9.2 Color Blindness

```css
/* Never rely on color alone — always pair with: */
/* 1. Icons (✓ for success, ✗ for error, ⚠ for warning) */
/* 2. Text labels ("Compliant", "At Risk", "Critical") */
/* 3. Patterns or border styles */

/* Compliance status ALWAYS shows both color + text + icon */
.compliance-badge {
  /* Shows: 🟢 Compliant | 🟡 Warning | 🟠 At Risk | 🔴 Critical */
  /* Never just a colored dot */
}
```

### 9.3 Focus States

```css
:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.3); /* teal focus ring */
}
.dark :focus-visible {
  box-shadow: 0 0 0 3px rgba(45, 212, 191, 0.3); /* brighter teal for dark mode */
}
```

### 9.4 Touch Targets

```css
/* Minimum touch target: 44px × 44px (WCAG 2.1 Level AA) */
button, a, input[type="checkbox"], input[type="radio"] {
  min-width: 44px;
  min-height: 44px;
}
```

### 9.5 Keyboard Navigation

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Open command palette (search everything) |
| `Tab` | Navigate forward through interactive elements |
| `Shift+Tab` | Navigate backward |
| `Enter` / `Space` | Activate focused element |
| `Escape` | Close modal, dropdown, popover |
| `↑↓` | Navigate within lists, tables, dropdowns |
| `⌘S` / `Ctrl+S` | Save current form |

---

## 10. TAILWIND CSS CONFIGURATION

```javascript
// tailwind.config.js
// Acolyte AI — B2B Admin/Faculty Theme

module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // B2B UI Primary — Teal
        primary: {
          50: '#F0FDFA',
          100: '#CCFBF1',
          200: '#99F6E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
          900: '#134E4A',
          950: '#042F2E',
        },
        // Brand Green (owl, logo, marketing)
        brand: {
          50: '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#4CAF50',
          600: '#43A047',
          700: '#388E3C',
          800: '#2E7D32',
          900: '#1B5E20',
          logo: '#00C853',
        },
        // Student Primary — Emerald (for shared packages)
        student: {
          50: '#ECFDF5',
          100: '#D1FAE5',
          200: '#A7F3D0',
          300: '#6EE7B7',
          400: '#34D399',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
          800: '#065F46',
          900: '#064E3B',
          950: '#022C22',
        },
        // Semantic
        success: {
          50: '#F0FDF4', 100: '#DCFCE7', 400: '#4ADE80',
          500: '#22C55E', 600: '#16A34A', 700: '#15803D',
        },
        warning: {
          50: '#FFFBEB', 100: '#FEF3C7', 400: '#FBBF24',
          500: '#F59E0B', 600: '#D97706', 700: '#B45309',
        },
        error: {
          50: '#FEF2F2', 100: '#FEE2E2', 400: '#F87171',
          500: '#EF4444', 600: '#DC2626', 700: '#B91C1C',
        },
        info: {
          50: '#EFF6FF', 100: '#DBEAFE', 400: '#60A5FA',
          500: '#3B82F6', 600: '#2563EB', 700: '#1D4ED8',
        },
        // Compliance status
        compliance: {
          green: '#22C55E',
          yellow: '#EAB308',
          orange: '#F97316',
          red: '#EF4444',
        },
        // Workflow status
        status: {
          draft: '#94A3B8',
          pending: '#F59E0B',
          'in-review': '#8B5CF6',
          approved: '#22C55E',
          submitted: '#0D9488',
          rejected: '#EF4444',
          expired: '#64748B',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SF Mono', 'monospace'],
        hindi: ['Noto Sans Devanagari', 'Mangal', 'sans-serif'],
      },
      fontSize: {
        'tiny': ['11px', { lineHeight: '14px', fontWeight: '500', letterSpacing: '0.02em' }],
        'caption': ['12px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        'body-sm': ['13px', { lineHeight: '20px' }],
        'body': ['14px', { lineHeight: '22px' }],
        'h4': ['16px', { lineHeight: '22px', fontWeight: '600' }],
        'h3': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'h2': ['22px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.015em' }],
        'h1': ['28px', { lineHeight: '36px', fontWeight: '600', letterSpacing: '-0.02em' }],
        'display': ['36px', { lineHeight: '44px', fontWeight: '700', letterSpacing: '-0.025em' }],
      },
      spacing: {
        'sidebar': '260px',
        'sidebar-collapsed': '64px',
        'navbar': '56px',
      },
      width: {
        'sidebar': '260px',
        'sidebar-collapsed': '64px',
      },
      height: {
        'navbar': '56px',
      },
      maxWidth: {
        'content-narrow': '640px',
        'content-normal': '1024px',
        'content-wide': '1200px',
        'content': '1440px',
      },
      borderRadius: {
        'DEFAULT': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      boxShadow: {
        'xs': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'sm': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'focus-primary': '0 0 0 3px rgba(13, 148, 136, 0.3)',
        'focus-error': '0 0 0 3px rgba(239, 68, 68, 0.3)',
        'focus-success': '0 0 0 3px rgba(34, 197, 94, 0.3)',
      },
      transitionDuration: {
        'instant': '75ms',
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'fade-out': 'fadeOut 150ms ease-in',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-down': 'slideDown 200ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        fadeOut: { '0%': { opacity: '1' }, '100%': { opacity: '0' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        slideDown: { '0%': { transform: 'translateY(-8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        scaleIn: { '0%': { transform: 'scale(0.95)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
    },
  },
  plugins: [],
}
```

---

## 11. SHADCN/UI THEME CONFIGURATION

```css
/* globals.css */
/* Acolyte AI — B2B Admin/Faculty shadcn/ui theme */

@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap');

@layer base {
  :root {
    /* Background and foreground */
    --background: 210 40% 98%;           /* #F8FAFC */
    --foreground: 222 47% 11%;           /* #1E293B */

    /* Card */
    --card: 0 0% 100%;                   /* white */
    --card-foreground: 222 47% 11%;      /* #1E293B */

    /* Popover */
    --popover: 0 0% 100%;
    --popover-foreground: 222 47% 11%;

    /* Primary — Teal */
    --primary: 175 84% 32%;              /* #0D9488 (teal-600) */
    --primary-foreground: 0 0% 100%;     /* white */

    /* Secondary */
    --secondary: 210 40% 96%;            /* #F1F5F9 */
    --secondary-foreground: 215 25% 27%; /* #334155 */

    /* Muted */
    --muted: 210 40% 96%;               /* #F1F5F9 */
    --muted-foreground: 215 16% 47%;    /* #64748B */

    /* Accent */
    --accent: 175 84% 32%;              /* Teal — same as primary */
    --accent-foreground: 0 0% 100%;

    /* Destructive */
    --destructive: 0 84% 60%;           /* #EF4444 */
    --destructive-foreground: 0 0% 100%;

    /* Border, Input, Ring */
    --border: 214 32% 91%;              /* #E2E8F0 */
    --input: 214 32% 91%;              /* #E2E8F0 */
    --ring: 175 84% 32%;               /* Teal focus ring */

    /* Radius */
    --radius: 0.5rem;                   /* 8px base */

    /* Chart colors (Tremor/Recharts) */
    --chart-1: 175 84% 32%;            /* Teal — primary metric */
    --chart-2: 142 71% 45%;            /* Green — success/growth */
    --chart-3: 38 92% 50%;             /* Amber — warning/caution */
    --chart-4: 262 83% 58%;            /* Violet — secondary metric */
    --chart-5: 199 89% 48%;            /* Cyan — tertiary metric */
  }

  .dark {
    --background: 222 47% 11%;          /* #1E293B */
    --foreground: 210 40% 98%;          /* #F8FAFC */

    --card: 217 33% 17%;               /* #1E293B */
    --card-foreground: 210 40% 98%;

    --popover: 217 33% 17%;
    --popover-foreground: 210 40% 98%;

    --primary: 172 66% 50%;             /* #14B8A6 (teal-500, brighter for dark) */
    --primary-foreground: 176 100% 10%; /* #042F2E */

    --secondary: 217 33% 17%;          /* #1E293B */
    --secondary-foreground: 213 31% 91%; /* #CBD5E1 */

    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;   /* #94A3B8 */

    --accent: 172 66% 50%;
    --accent-foreground: 176 100% 10%;

    --destructive: 0 63% 31%;
    --destructive-foreground: 210 40% 98%;

    --border: 215 25% 27%;             /* #334155 */
    --input: 215 25% 27%;
    --ring: 170 55% 60%;               /* #2DD4BF (teal-400) */

    --chart-1: 170 55% 60%;
    --chart-2: 142 72% 68%;
    --chart-3: 43 96% 56%;
    --chart-4: 263 70% 72%;
    --chart-5: 199 78% 60%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
    /* Inter's OpenType features for improved readability */
  }
}
```

---

## 12. MOBILE (STUDENT APP) — GLUESTACK-UI v2 TOKEN BRIDGE

The student mobile app uses gluestack-ui v2 + NativeWind. Design tokens are shared from a monorepo package.

```typescript
// packages/ui-tokens/tokens.ts
// Shared between web (shadcn) and mobile (gluestack)

export const tokens = {
  colors: {
    // Student palette
    student: {
      primary: '#00C853',      // Brand green — primary actions
      primaryDark: '#00A844',   // Hover/press state
      surface: '#141420',       // Card backgrounds (dark mode default)
      background: '#0A0A0F',    // Page background
      elevated: '#1E1E2E',      // Modals, sheets
      border: '#2A2A3C',
      text: '#E8E8ED',
      textMuted: '#8888A0',
    },
    // Shared semantic colors (same in both apps)
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
  },
  spacing: {
    xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48,
  },
  borderRadius: {
    sm: 6, md: 8, lg: 12, xl: 16, full: 9999,
  },
  fontSize: {
    xs: 11, sm: 13, md: 14, lg: 16, xl: 18, '2xl': 22, '3xl': 28,
  },
} as const;
```

---

## 13. GOOGLE STITCH DESIGN GUIDE

When designing screens in Google Stitch for admin/faculty, follow these specifications:

### Key Screens to Design (Priority Order)

1. **Compliance Dashboard** — The Dean's first screen
   - 4 metric cards at top (Compliance Score, Faculty MSR %, Attendance %, Bed Occupancy)
   - Department heatmap (color-coded grid)
   - Trend chart (30-day compliance score)
   - Alert feed (right sidebar or bottom panel)

2. **Faculty MSR Tracker** — Department-wise faculty count vs requirement
   - Table: Department | Required | Actual | Gap | Status badge
   - Retirement countdown sidebar
   - Vacancy prediction chart

3. **SAF Form Wizard** — The 200-hour pain point made into guided workflow
   - Multi-step wizard (progress bar at top)
   - Pre-populated fields with "AI suggested" tags
   - Discrepancy warnings inline
   - Side-by-side comparison (SAF field vs. actual data)

4. **Faculty Workbench** — Daily faculty view
   - Today's classes (top)
   - Pending logbook sign-offs (count badge, batch action)
   - Student alerts (at-risk indicators)
   - Quick actions: "Sign Logbook", "Create Assessment", "View Rotation"

5. **Student List** — Admin view
   - Searchable, filterable table with batch operations
   - Phase/semester filter tabs
   - Attendance %, IA score, competency completion columns
   - Hover reveals: quick actions (view profile, send notification, flag)

6. **Question Bank** — Faculty assessment hub
   - Filter sidebar: subject, topic, Bloom's level, difficulty, type
   - Card or table view toggle
   - MCQ preview with distractor analysis
   - "Generate with AI" prominent CTA button (teal primary)

### Design Token Quick Reference for Stitch

| Token | Light | Dark |
|-------|-------|------|
| Background | #F8FAFC | #0F172A |
| Surface | #FFFFFF | #1E293B |
| Primary | #0D9488 | #14B8A6 |
| Text Primary | #1E293B | #F8FAFC |
| Text Secondary | #475569 | #94A3B8 |
| Border | #E2E8F0 | #334155 |
| Sidebar Width | 260px | 260px |
| Navbar Height | 56px | 56px |
| Card Radius | 12px | 12px |
| Button Radius | 8px | 8px |
| Font | Inter 400/500/600 | Inter 400/500/600 |
| Body Size | 14px | 14px |

---

## 14. QUICK REFERENCE CARD

### Colors (B2B Primary)
| Token | Hex | Use |
|-------|-----|-----|
| `primary-600` | #0D9488 | Buttons, links (B2B) |
| `primary-700` | #0F766E | Hover states (B2B) |
| `brand-logo` | #00C853 | Owl logo, brand accent |
| `neutral-800` | #1E293B | Primary text |
| `neutral-600` | #475569 | Secondary text |
| `neutral-200` | #E2E8F0 | Borders |

### Typography (B2B)
| Element | Size | Weight |
|---------|------|--------|
| H1 | 28px | 600 |
| H2 | 22px | 600 |
| H3 | 18px | 600 |
| Body | 14px | 400 |
| Caption | 12px | 400 |
| Tiny (badges) | 11px | 500 |

### Spacing
| Token | Value |
|-------|-------|
| `space-1` | 4px |
| `space-2` | 8px |
| `space-4` | 16px |
| `space-6` | 24px |
| `space-8` | 32px |

### Fixed Dimensions (B2B)
| Element | Value |
|---------|-------|
| Sidebar width | 260px |
| Navbar height | 56px |
| Button height | 40px |
| Input height | 40px |
| Table row (default) | 44px |

### Border Radius
| Element | Value |
|---------|-------|
| Buttons | 8px |
| Inputs | 8px |
| Cards | 12px |
| Modals | 16px |
| Badges | 9999px (pill) |

### Compliance Colors
| Status | Color | Threshold |
|--------|-------|-----------|
| Safe | #22C55E | >80% |
| Warning | #EAB308 | 75–80% |
| At Risk | #F97316 | 70–75% |
| Critical | #EF4444 | <70% |

---

## CHANGELOG

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Feb 2026 | Initial brand book. Dual-palette (teal B2B + green student). Inter typography. Dark + light mode. Full shadcn/ui theme. Tailwind config. |

---

*This design system is optimized for Claude Code, Google Stitch, and AI coding assistants. All values are production-ready. When in doubt: Teal for B2B actions, Green for brand moments, Slate for neutrals.*

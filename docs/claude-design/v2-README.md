# Handoff: Easy Life CRM — אתר שיווקי + מערכת CRM (RTL, עברית)

## Overview
Easy Life ("חיים קלים") is a Hebrew, RTL-first subscription SaaS for Israeli small businesses: a self-serve library of pre-built AI agents (WhatsApp service, video creation, social/leads, content) that a business owner connects in one click. The product is architected around **"One Brain"** — all agents and humans share one state, so the CRM fills itself from agent activity.

This bundle contains the full site: a marketing **landing page** plus **eight interlinked dashboard app screens** — Dashboard (overview), Live Feed, Inbox, CRM, Connections, Cashflow (financial dashboard), Settings, and Agents (chat workspace with the AI agents).

## About the Design Files
The files in `design_files/` are **design references authored in HTML** — high-fidelity prototypes showing intended look, layout, and behavior. They are **not production code to copy directly**.

They were built as "Design Components" (`.dc.html`) that render through a small runtime (`support.js`). **Do not port the `.dc.html` format or `support.js` into production.** Instead, **recreate these designs in the target codebase's real environment** using its established patterns. The source product is a **React + Tailwind v4** app (see Design Tokens → source of truth), so a React/Tailwind implementation is the natural target. If starting fresh, React + Tailwind + an RTL-aware setup is recommended.

Each `.dc.html` file has two logical parts you should read:
- **Template markup** — the JSX-like structure with inline styles (`<x-dc>…</x-dc>` body).
- **Logic class** (`class Component extends DCLogic`) — state, data arrays, and handlers. Treat this as a spec for component state and mock data, not code to lift.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified. Recreate the UI pixel-perfectly using the codebase's existing libraries and the Easy Life design system tokens below. All data shown is realistic mock data — wire it to real APIs.

## Global Chrome (shared by all 8 app screens)
Every app screen (not the landing page) shares a top chrome, defined in `design_files/crmChrome.js`:
- **Top bar** (sticky, z-40, white 95% + `backdrop-filter: blur(8px)`, bottom hairline `rgba(15,23,42,.08)`, padding `16px 28px 12px`):
  - **Logo lockup** (inline-start): 32px teal (`#0e8ba0`) rounded square (radius 9px) with a white Sparkles heroicon, next to wordmark "Easy Life" in Space Grotesk 600, 15px — "Life" in teal. Links to `Landing`.
  - **Search field** (center, flex:1, max-width 560px): hairline border, bg `#f5f7fb`, radius 10px, magnifier heroicon + placeholder "חיפוש עסקאות, לידים, אנשי קשר…".
  - **Right cluster**: notification bell button (hairline, radius 10px, teal dot badge) + user chip (32px round avatar "י" with green presence dot, name "ישראל" / role "בעלים").
- **Nav row** (horizontal, scrollable, `scrollbar-hide`, padding `0 20px`): tabs = **סקירה** (Dashboard), **פיד חי** (Feed), **אינבוקס** (Inbox), **סוכנים** (Agents), **CRM**, **חיבורים** (Connections), **תזרים** (Cashflow), **הגדרות** (Settings). Each: heroicon + label, 13.5px, padding `11px 14px`. Active tab: ink `#0f172a`, weight 600, with a 2px teal underline pill at the bottom (`inset-inline:8px; bottom:0`). Inactive: `#55627a`.

Implement this once as a shared `<AppShell>` / layout component with the nav config driven by data (as `crmChrome.js` does).

## Screens / Views

### 1. Landing (`Landing.dc.html`)
- **Purpose**: Marketing page; convert business owners to sign up.
- **Layout**: Single scrolling column, centered content max-width ~1100–1240px, page bg `#f5f7fb`.
- **Sections** (top → bottom):
  1. **Top nav** — wordmark + anchor links + primary CTA button.
  2. **Hero** — eyebrow, large headline (Space Grotesk, teal→blue→ink text gradient on key figures), subhead, CTA buttons, and a **3D-glass product visual** in a tilting card. The visual is an `image-slot` (drag-to-fill placeholder) prefilled with brand rendered-3D art (`assets/hero/f_54.jpg`). Floating KPI/WhatsApp chips layer over it.
  3. **"מוח אחד" (One Brain) section** — headline + an `image-slot` prefilled with `assets/hero/f_44.jpg`.
  4. **How it works** — 3 steps.
  5. **Agents grid**, **pricing**, **testimonials/FAQ**, **footer CTA** (present in file; follow the markup).
- **Note**: An earlier scroll-driven "brain awakens" animation was **removed** at the user's request — do not reintroduce it.
- **image-slot**: `design_files/image-slot.js` is a drag-and-drop image placeholder. In production replace with a normal `<img>` / CMS image; keep the "cover" fit and rounded framing.

### 2. Dashboard / סקירה (`Dashboard.dc.html`)
- **Purpose**: Morning control room — what's happening in the business now.
- **Layout**: App shell + main (max-width ~1240px, padding `28px`). Time-aware greeting header ("בוקר טוב, ישראל"). Then: **KPI row** (4 `KpiCard`s, count-up animation ~1.1s, tabular-nums), a **deal pipeline** preview, a **connections panel**, and an **assistant chat** panel (framed inset, bordered `rgba(15,23,42,.08)`, radius 14px, bg `#f8fafc`, padding 16px).
- **Connections panel rows**: 36px tinted rounded-square icon (line heroicon, `currentColor` in the tint's accent) + name + meta + status `Badge`. Channels: WhatsApp (green `#12805c`), Instagram (violet `#7c6cf0`), Email (info `#0e7490`), Store (warning `#b26a00`). **Use line SVG icons, never emoji, for these.**

### 3. Live Feed / פיד חי (`Feed.dc.html`)
- **Purpose**: Real-time event timeline (One-Brain events; in production an SSE stream).
- **Layout**: App shell + centered feed column. Rows animate in with **feed-in** (400ms, opacity + 8px rise, staggered ~30–40ms).
- **Event row**: emoji **verb glyph** (💬 message, 🎯 lead, 🏆 won, 🛒 order, 🧠 memory) in a tinted circle + actor + description + timestamp (Hebrew relative, e.g. "לפני 6 דק׳"). Emoji here is intentional (event verbs) — keep it.

### 4. Inbox / אינבוקס (`Inbox.dc.html`)
- **Purpose**: Unified customer conversations across channels.
- **Layout**: Two-pane — conversation **list** (inline-start) + **thread** view. List rows: avatar, name, channel badge, last-message preview, unread dot. Thread: message bubbles (incoming vs outgoing), composer at bottom.

### 5. CRM (`CRM.dc.html`)
- **Purpose**: The self-filling CRM.
- **Layout**: App shell + main (max-width 1200px). Header with title/subtitle, a search input (radius 12px, teal focus ring), and a "+ חדש" primary button.
- **Tabs** (underline style, tabular count per tab): **חשבונות** (accounts), **אנשי קשר** (contacts), **עסקאות** (deals). Live client-side search filters the active tab.
- **Table**: white `glass-card` (radius 10px), header row bg `rgba(241,245,249,.5)`, rows with hairline dividers and hover fill `rgba(241,245,249,.6)`. First cell = hashed-tint round initials avatar + name. Status/stage cells use tinted **StatusPill/Badge** (stage tones: ליד `#0e7490`, מוכשר `#0b7688`, הצעה `#b26a00`, משא ומתן ink, זכייה `#12805c`). Empty state: centered glyph + message.

### 6. Connections / חיבורים (`Connections.dc.html`)
- **Purpose**: One-click connect the business's channels.
- **Layout**: App shell + main (max-width 1080px). A "demo mode" warning banner (warning tint). Then category sections (הודעות, רשתות חברתיות, דוא״ל, חנות, פיננסים, פרודוקטיביות), each a 3-col grid of app cards.
- **App card** (`glass-card`, hover shadow lift): 44px tinted rounded-square **emoji** app glyph + name (+ "ישיר" pill for native connectors) + note + a connect/disconnect toggle button (connected = green outline w/ check; disconnected = teal gradient "חיבור"). Toggling shows a toast (bottom-center, 2.6s).

### 7. Cashflow / תזרים (`Cashflow.dc.html`) — full financial dashboard
- **Purpose**: A business owner's real financial picture once data sources are connected.
- **Layout**: App shell + main (max-width 1180px). Sections:
  1. **Hero** — eyebrow "Cash Intelligence", title, and a dark **"יתרה נוכחית"** balance card (bg `#0e1a2b`, cyan radial glow, ₪ 86,400 in Space Grotesk 46px, +21% delta, mini teal→cyan bar trend).
  2. **KPI row** — 4 cards (הכנסות, הוצאות, מאזן נטו, צפי) with up/down delta arrows (success/danger).
  3. **Income-vs-Expenses chart** — SVG area+line. **Green** income line (`#12805c`, filled area) + **red** expense line (`#d1453b`). Y-axis gridlines with ₪K value labels. **Interactive**: crosshair on hover with a dual tooltip (income + expenses at that point) and a net-balance readout above. `cf-line` draw-in animation (stroke-dashoffset, 1.8s).
     - **Range chips**: 30 יום / 3 חודשים / חצי שנה / שנה (segmented pill; active = white w/ shadow).
     - **Date picker**: a "בחר תאריך" button opens an inline calendar (month nav, RTL weekday header, future dates disabled, selected day teal-filled, today outlined) to pick a custom start date; picking one recomputes the series.
  4. **Breakdown** — 2-col: "לאן הכסף הולך" (expense categories, colored progress bars, amount + %) and "מקורות הכנסה" (income sources, same treatment).
  5. **Recent transactions** — list with green(in)/red(out) dot, description, date · category, and signed ₪ amount.
  6. **Feature cards** (4) + **sources** grid (line icons, not emoji) + a link to Connections.

### 8. Settings / הגדרות (`Settings.dc.html`)
- **Purpose**: Profile, business details, agents, notifications, plan.
- **Layout**: App shell + main (max-width 920px), stacked `glass-card` sections: **פרופיל** (avatar + name/role/email/phone inputs), **פרטי העסק**, **הסוכנים שלך** (list with toggle switches, "X פעילים מתוך Y"), **התראות** (toggle rows), **מנוי וחיוב** (highlighted plan card ₪349/mo + upgrade link). Sticky-ish footer actions: ביטול + "שמירת שינויים" (turns to "נשמר ✓").
- **Toggle switch**: 44×26 track, radius 999px, teal when on (`#0e8ba0`) / slate `#cbd5e1` when off; 20px white knob, slides on `inset-inline-start` 180ms.

### 9. Agents / סוכנים (`Agents.dc.html`)
- **Purpose**: Chat workspace where the owner talks to the AI agents, fires actions, and approves work. (This replaced a separate "Approvals" page — approvals now happen inline in chat.)
- **Layout**: App shell + main (max-width 1240px). Two-column, fixed 660px height: **agent list** (300px) + **chat panel**.
- **Agent list** (`glass-card`): header "סוכנים פעילים", rows = 44px tinted rounded-square icon (with green presence dot) + name + status. Selected row: teal tint bg + 3px teal inset bar. Four agents: **סוכן וואטסאפ** (`#12805c`), **סוכן יצירת וידאו** (`#7c6cf0`), **סוכן רשתות ולידים** (`#0e8ba0`), **סוכן תוכן** (`#b26a00`). "+ הוספת סוכן" footer.
- **Chat panel** (`glass-card`): header (agent icon + name + capability + "פעיל" status pill); scrolling message area (bg `#f8fafc`); **quick-action chips** row (per-agent, e.g. "שלח קמפיין ללקוחות", "צור סרטון מוצר", "מצא לידים חדשים", "כתוב פוסט"); composer input + teal send button.
- **Message bubbles**: agent = white, hairline, radius `16px 16px 16px 5px`, shadow, `white-space: pre-line`; user = teal `#0e8ba0`, white text, radius `16px 16px 5px 16px`, inline-end aligned.
- **Rich card message types** (agent replies): **approval** (warning-tinted, preview box, אישור ושליחה / דחייה), **campaign** (audience + timing meta, שליחה עכשיו / עריכה), **video** (16:9 dark thumbnail with play button + duration, אישור ופרסום / גרסה נוספת), **leads** (list of lead rows each with "הוסף ל‑CRM"). Actions append a confirmation agent message. Sending a free-text message appends a user bubble + a canned agent ack after ~420ms.

## Interactions & Behavior
- **Navigation**: top-nav tabs link between screens via relative hrefs; recreate as router routes.
- **Count-up**: KPI values animate from 0 (~1.1s) on mount.
- **feed-in**: list/feed items rise + fade (400ms `cubic-bezier(.22,1,.36,1)`), staggered.
- **Hover**: cards lift `translateY(-2px)` + shadow to `pop`; buttons darken (primary teal → `#0b7688`); rows get surface fill. **Press**: `scale(.98)`.
- **Focus**: 2px teal ring @ 2px offset (`:focus-visible`); inputs get teal border + 3px soft-teal ring.
- **Cashflow chart**: mousemove → nearest data index → crosshair + tooltip; mouseleave clears. Range chips + calendar recompute the series and axis.
- **Toggles/toasts**: Connections + Settings toggles flip state; Connections shows a 2.6s toast.
- **Agents**: quick-action chip → user bubble + delayed rich-card reply; card buttons → confirmation message; auto-scroll chat to bottom on new message.
- All motion disabled under `prefers-reduced-motion`.

## State Management
- **Global/shell**: active nav route; current user; search query.
- **CRM**: active tab (accounts/contacts/deals), search string; per-tab filtered lists.
- **Cashflow**: selected range (`30d`/`3m`/`6m`/`1y`) OR custom `fromDate`; hovered chart index; calendar open + displayed month. Series/axis/labels are derived from range or custom start (see `_chart()` and the `R` range map in the logic class).
- **Connections**: per-app connected map; transient toast text.
- **Settings**: agents[] on/off, notifications[] on/off, "saved" flag.
- **Agents**: active agent key; per-agent message thread (array of typed messages); composer input. Seed data + action definitions live in `_seed()` / `_actionDefs()` — use as the shape for real API responses.
- **Data fetching**: replace all mock arrays with API calls. Feed = SSE/websocket stream. Inbox/CRM/Cashflow = REST/query. Agents = your agent backend; card types map to structured agent tool outputs.

## Design Tokens
**Source of truth**: the app's `web/src/index.css` (Tailwind v4 `@theme`). ⚠️ The accent token is named `--color-gold` but its **value is teal `#0e8ba0`** — the name is legacy; the brand is teal.

**Color**
- Canvas `#f5f7fb`; surface `#ffffff`; sunken/hover `#f1f5f9`.
- Text: ink `#0f172a`, muted `#55627a`, faint `#94a3b8`.
- Hairlines: `rgba(15,23,42,.08)` and `.16` (slate ink at low alpha, not gray).
- **Accent teal `#0e8ba0`**; hover/text `#0b7688`; soft tint `rgba(14,139,160,.1)`.
- Semantics (each with ~10%-alpha soft tint): success `#12805c`, danger `#d1453b`, warning `#b26a00`, info `#0e7490`.
- Glow/chart accents: cyan `#22b8cf`, violet `#7c6cf0`, blue `#6d8bf0`.

**Type**
- **Heebo** (300–800) — all body/UI (default 14px).
- **Space Grotesk** (400–700) — wordmark, hero numeric figures, board titles.
- **Inter** — stray Latin.
- Scale (rem): .75 / .8125 / .875 / 1 / 1.125 / 1.25 / 1.5 / 1.875 / 2.25. Body line-height 1.5; display 1.15; tighten tracking (−.01/−.02em) on large headings only.
- Numbers are always **tabular-nums**.

**Spacing & layout**: 4/8 rhythm; vertical tiers 16/24/32/48. Page gutter 24–32px; content max-width ~1400px.

**Radii**: chips 8px, **cards 10px** (`glass-card`), controls (buttons/inputs) 12px, modals 16px, pills/avatars 999px.

**Elevation** (cool slate, never black): card `0 1px 2px rgba(15,23,42,.04)`, raised `.07`, pop/hover `0 4px 12px rgba(15,23,42,.10)`, overlay `0 12px 32px rgba(15,23,42,.14)`.

**Motion**: micro 150–220ms ease-out; signature easings `cubic-bezier(.22,1,.36,1)` and `cubic-bezier(.16,1,.3,1)`. Named: feed-in (400ms), drawer-in (280ms), fade-in (200ms), pulse-dot (2s), count-up (~1.1s).

## RTL requirements
- `dir="rtl"`, `lang="he"` at the root.
- Use **logical properties only** (`inline-start/end`, `margin-inline`, `padding-inline`, `inset-inline`) so mirroring is automatic — the designs already do this.
- Latin appears only for the wordmark, ₪ glyph, code/emails, and numbers. Numbers/money stay LTR within RTL context (`dir="ltr"` on the number span where needed).
- Money: always ₪ (ILS), whole shekels, `he-IL` formatting (₪ 12,500; compact ₪ 12.5K). Stored as integer agorot (₪1 = 100 agorot).

## Iconography
- **Structural icons**: inline SVG, **Heroicons (outline), stroke ~1.6**, `currentColor`, sizes 16/20/24. (Lucide coexists for a few nav glyphs.) **Never emoji for structural/interactive icons.**
- **Emoji as glyphs only**: event verbs in the Feed, empty-state marks, and rare inline warmth (👋). Connections app-tiles use emoji app glyphs by design; channel icons in Dashboard/Cashflow use line SVGs.

## Assets
- `assets/hero/f_44.jpg`, `assets/hero/f_54.jpg` — frames of the brand's rendered-3D glass art (teal ribbons + shekel coins on studio-white). Used to prefill the landing image slots. In production, use your real brand imagery.
- `assets/favicon.svg` — ring/bullseye "one brain" mark. ⚠️ Still in **legacy gold** (`#C9A96A`), not teal — re-export in teal if needed.
- The design system's `_ds_bundle.js` + token CSS were loaded from `_ds/…f48ab4a9…/`. In production, use your own design-token setup (the values are all listed above).

## Files
In `design_files/`:
- `Landing.dc.html` — marketing landing page
- `Dashboard.dc.html` — overview / סקירה
- `Feed.dc.html` — live feed / פיד חי
- `Inbox.dc.html` — inbox / אינבוקס
- `CRM.dc.html` — accounts/contacts/deals
- `Connections.dc.html` — חיבורים
- `Cashflow.dc.html` — תזרים (financial dashboard)
- `Settings.dc.html` — הגדרות
- `Agents.dc.html` — סוכנים (agent chat workspace)
- `crmChrome.js` — shared top-nav config/helper (→ build as `<AppShell>`)
- `image-slot.js` — drag-drop image placeholder (→ replace with `<img>`/CMS in prod)
- `support.js` — the `.dc.html` runtime. **Reference only — do not port to production.**

## How to read a `.dc.html` file
Open any file and you'll see the template markup (JSX-like, inline styles) followed by a `class Component extends DCLogic { … }` block. The template = structure + styling; the class = state, mock data, and handlers. Recreate both in your framework's idioms (React components + hooks/state, Tailwind classes mapped to the tokens above). Ignore `support.js`, `<x-dc>`, `<helmet>`, `dc-import`, and `x-import` — those are prototype-runtime constructs, not part of the design.

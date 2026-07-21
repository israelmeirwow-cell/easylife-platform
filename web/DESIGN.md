# Easy Life — Design System v2 (premium, human, production-grade)

Derived via ui-ux-pro-max for a B2B CRM/SaaS dashboard, adapted to Easy Life's identity (warm neutrals + signature gold, RTL Hebrew). Goal: polished depth, refined hierarchy, alive micro-interactions — not a flat template.

## Foundations

### Typography
- **Heebo** (Hebrew-native, professional) — the single family. Weights: 300/400/500/600/700/800.
- Type scale (rem): 0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.375 / 1.75 / 2.25 / 3. Line-height 1.5 body, 1.15 display.
- Weight hierarchy: display 700-800, headings 600-700, labels 500, body 400.
- **Tabular numbers** (`font-variant-numeric: tabular-nums`) for ALL money, counts, dates, table figures — no layout shift.
- Letter-spacing: -0.01em to -0.02em on large headings only; normal on body.

### Color (warm-neutral premium + gold accent)
Not flat gray — warm-tinted neutrals give a human, expensive feel.
- `--bg` app canvas: `#F6F5F1` (warm ivory)
- `--surface`: `#FFFFFF`; `--surface-2` raised: `#FCFBF9`; `--surface-sunken`: `#F1EFE9`
- `--ink` primary text: `#1C1A16`; `--ink-2` secondary: `#57534C`; `--ink-3` muted: `#8A857C`
- `--border`: `#E9E5DD`; `--border-strong`: `#DAD4C8`
- `--gold` brand accent: `#B8935A` (deepened for contrast/AA); `--gold-soft` chip bg: `#F4EDDF`; `--gold-ink` on gold: `#2A2113`
- `--charcoal` emphasis: `#1C1A16`
- Semantic: success `#2F7D5B`/soft `#E3F1EA`; danger `#C0453B`/soft `#FBE9E7`; warning `#B9812A`/soft `#F7ECD6`; info `#3A6FA5`/soft `#E7F0F8`
- Kanban stage accents (muted, distinct): lead slate `#6B7A8F`, qualified indigo `#6D6AA8`, proposal gold `#B8935A`, negotiation amber `#C08A3E`, won green `#2F7D5B`, lost rose `#B06A6A`
- Contrast: all text pairs ≥4.5:1. Gold used for accents/emphasis, not body text.

### Elevation (warm, soft — never harsh black)
Shadow color `28 24 16 / a` (warm). Scale:
- `--sh-sm`: 0 1px 2px rgba(28,24,16,.04), 0 1px 3px rgba(28,24,16,.06)
- `--sh-md`: 0 2px 4px rgba(28,24,16,.04), 0 6px 16px rgba(28,24,16,.07)
- `--sh-lg`: 0 8px 24px rgba(28,24,16,.08), 0 2px 6px rgba(28,24,16,.05)
- Cards rest on `--sh-sm`, lift to `--sh-md` on hover.

### Radius & spacing
- Radius: controls 10px, cards 16px, chips/pills 999px, modals 20px.
- Spacing: strict 4/8 rhythm. Vertical hierarchy tiers: 16 / 24 / 32 / 48. Page gutter 24-32px; content max-width ~1280px.

### Motion (alive but disciplined)
- Micro-interactions 150-220ms `ease-out`; exits ~70% of enter.
- Card hover: translateY(-2px) + shadow lift. Press: scale(0.98).
- List/grid entrance: staggered fade+rise (opacity 0→1, y 8→0), 30-40ms stagger.
- Kanban drag: real-time follow, smooth column reflow, drop settle.
- Respect `prefers-reduced-motion` (disable transforms/stagger).
- Skeleton shimmer for loads >300ms (no bare spinners on data).

## Components (consistent system)
- **Sidebar**: grouped nav (ראשי / CRM / מערכת), active = gold left-border + soft gold bg + gold icon; hover subtle. Collapsible. Logo lockup top.
- **Top bar**: global search (⌘K affordance), notifications bell w/ badge, user menu (avatar + name + role). Sticky, subtle bottom border.
- **KPI card**: icon chip (soft semantic bg) + label (ink-2, 500) + big tabular value + optional delta pill (▲/▼ colored) + sparkline optional. Hover lift.
- **Tables**: sticky header, row hover bg, avatars (initials in tinted circle), tabular figures, sortable headers w/ aria-sort, zebra off (use hover), empty state.
- **Kanban card**: top stage-accent hairline, title (600), account/contact w/ avatar, value tabular ₪, owner chip; grab cursor; hover lift; column header = name + count pill + total ₪.
- **Detail 360**: header band (avatar, name, key facts, quick actions), tabbed panels, timeline w/ connector line + node dots by verb, related lists as compact cards.
- **Buttons**: primary = gold bg / gold-ink; secondary = surface + border; ghost; danger. Loading = spinner + disabled. 44px min touch.
- **Badges/pills**: status (semantic soft bg + darker ink + optional dot), priority.
- **Empty states**: icon + one-line + primary action.
- **Toasts**: aria-live, auto-dismiss 3-5s, semantic color, no focus steal.

## Rules (from ui-ux-pro-max audit)
- SVG icons only (Lucide), one stroke width (1.75), consistent sizes (16/20/24). No emoji as structural icons.
- cursor-pointer + visible focus ring (2px gold) on all interactives.
- Color never the only signal (icon/text too).
- RTL: logical props only (ms/me/ps/pe/start/end). Charts axis-inverted for RTL.
- Responsive: 375 / 768 / 1024 / 1440; mobile bottom-nav ≤5, desktop sidebar.

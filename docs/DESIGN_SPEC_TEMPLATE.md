# DESIGN_SPEC.md — Design Specification Template

> This document is produced by the Designer during "Phase 2: Design System Establishment".
> Once established, all subsequent development must strictly follow this specification.

---

## Design Foundation

### Design Direction
<!-- One sentence describing the product's visual tone -->
**Style Position:** [e.g., Clean Modern / Warm & Friendly / Professional Enterprise / Bold & Playful]

**Design References:**
- [Reference links or screenshot descriptions]

---

## Color System

### Primary Colors
| Usage | Hex Code | CSS Variable | Description |
|-------|----------|-------------|-------------|
| Primary | `#______` | `--color-primary` | Main interactive elements, CTA buttons |
| Primary Hover | `#______` | `--color-primary-hover` | Primary hover state |
| Primary Light | `#______` | `--color-primary-light` | Primary light background |

### Neutral Colors
| Usage | Hex Code | CSS Variable | Description |
|-------|----------|-------------|-------------|
| Text Primary | `#______` | `--color-text-primary` | Main body text |
| Text Secondary | `#______` | `--color-text-secondary` | Secondary text |
| Background | `#______` | `--color-bg` | Page background |
| Surface | `#______` | `--color-surface` | Card/panel background |
| Border | `#______` | `--color-border` | Dividers, borders |

### Semantic Colors
| Usage | Hex Code | CSS Variable |
|-------|----------|-------------|
| Success | `#______` | `--color-success` |
| Warning | `#______` | `--color-warning` |
| Error | `#______` | `--color-error` |
| Info | `#______` | `--color-info` |

---

## Typography

### Font Family
```css
--font-primary: '______', sans-serif;
--font-mono: '______', monospace;
```

### Type Scale
| Level | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| H1 | `__px` / `__rem` | `__` | `__` | Page title |
| H2 | `__px` / `__rem` | `__` | `__` | Section title |
| H3 | `__px` / `__rem` | `__` | `__` | Subsection title |
| Body | `__px` / `__rem` | `__` | `__` | Body text |
| Small | `__px` / `__rem` | `__` | `__` | Helper text |
| Caption | `__px` / `__rem` | `__` | `__` | Labels, timestamps |

---

## Spacing System

### Base Spacing Unit
```
--space-unit: __px;  /* base unit */
```

### Spacing Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `__px` | Icon-to-text gap |
| `--space-sm` | `__px` | Component inner padding |
| `--space-md` | `__px` | Between-component spacing |
| `--space-lg` | `__px` | Between-section spacing |
| `--space-xl` | `__px` | Major section separation |

---

## Border Radius System

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `__px` | Small buttons, tags |
| `--radius-md` | `__px` | Standard buttons, inputs |
| `--radius-lg` | `__px` | Cards, dialogs |
| `--radius-full` | `9999px` | Circular avatars, pill buttons |

---

## Card Structure

```css
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  box-shadow: ______;
}
```

### Card Variants
| Variant | className | Description |
|---------|-----------|-------------|
| Default | `.card` | Standard card |
| Elevated | `.card--elevated` | Card with shadow |
| Outlined | `.card--outlined` | Border only |

---

## Button System

| Variant | className | Background | Text Color | Usage |
|---------|-----------|------------|------------|-------|
| Primary | `.btn-primary` | `var(--color-primary)` | `#fff` | Primary action |
| Secondary | `.btn-secondary` | `transparent` | `var(--color-primary)` | Secondary action |
| Ghost | `.btn-ghost` | `transparent` | `var(--color-text-secondary)` | Subtle action |
| Danger | `.btn-danger` | `var(--color-error)` | `#fff` | Destructive action |

### Button Sizes
| Size | className | Padding | Font Size |
|------|-----------|---------|-----------|
| Small | `.btn--sm` | `__px __px` | `__px` |
| Medium | `.btn--md` | `__px __px` | `__px` |
| Large | `.btn--lg` | `__px __px` | `__px` |

---

## Responsive Breakpoints

| Breakpoint | Width | Description |
|------------|-------|-------------|
| Mobile | `< 640px` | Mobile layout |
| Tablet | `640px - 1024px` | Tablet layout |
| Desktop | `> 1024px` | Desktop layout |

### Key Responsive Rules
<!-- List the main responsive behaviors -->
- Navigation: Desktop horizontal / Mobile hamburger menu
- Card grid: Desktop 3-col / Tablet 2-col / Mobile 1-col
- ...

---

## Animation & Transitions

```css
--transition-fast: 150ms ease;
--transition-normal: 250ms ease;
--transition-slow: 350ms ease;
```

### Animation Principles
- Hover effects use `--transition-fast`
- Page transitions use `--transition-normal`
- Modal enter/exit uses `--transition-slow`

---

## Design QA Checklist

The designer checks the following items during visual QA:

- [ ] Colors: Do all colors match the color system definitions?
- [ ] Border radius: Are the correct radius tokens used?
- [ ] Spacing: Does component spacing follow the spacing system?
- [ ] Typography: Do font size, weight, and line height match definitions?
- [ ] Buttons: Are the correct button variants and sizes used?
- [ ] Responsive: Are 375px (mobile) and 1200px (desktop) screenshots correct?
- [ ] AI Skip Check: Were any style details skipped or missed by AI?

---
name: Mnestic
description: Private, local-first knowledge browser for browsing and searching personal notes
colors:
  accent: "#3b82f6"
  accent-hover: "#60a5fa"
  semantic-folder: "#10b981"
  semantic-calendar: "#8b5cf6"
  semantic-warning: "#f59e0b"
  semantic-error: "#ef4444"
  surface-primary: "#18181b"
  surface-elevated: "#1c1c20"
  surface-card: "#18181b"
  border-default: "#2d2d33"
  border-hover: "#3f3f46"
  text-primary: "#e4e4e7"
  text-secondary: "#a1a1aa"
  text-muted: "#71717a"
typography:
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  sm: "0.375rem"
  md: "0.75rem"
  lg: "0.75rem"
spacing:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
  chip-active:
    backgroundColor: "rgba(59, 130, 246, 0.12)"
    textColor: "{colors.accent-hover}"
    rounded: "{rounded.md}"
  chip-inactive:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
---

# Design System: Mnestic

## 1. Overview

**Creative North Star: "The Dark Workspace"**

A personal knowledge browser that feels like opening a well-organized desk drawer, not launching a SaaS product. Dark surfaces provide comfortable reading in any lighting. One accent carries intent. Two semantic colors carry category meaning. Everything else gets out of the way.

The system is deliberately restrained, Obsidian-sharp in its efficiency and Notion-warm in its readability. It rejects the "modern dark mode" aesthetic of blurred glass, gradient text, and hero metrics. Surfaces are opaque. Colors encode information. Typography creates hierarchy through weight and size, not through color gradients. The result is warm through craft: comfortable spacing, consistent rhythm, and text you can read for thirty minutes without fatigue.

**Key Characteristics:**
- Restrained color: one accent (blue) + two semantic colors (emerald for folders/content, purple for calendar)
- Solid surfaces: opaque backgrounds, no backdrop blur or glass sheen
- Weight-based hierarchy: bold for headings, regular for body, no gradient text anywhere
- Consistent vocabulary: filter chips, active states, and navigation follow one pattern across all pages
- High contrast body text: zinc-200 on zinc-950, not gray-400

## 2. Colors: The Workspace Palette

Three semantic colors carry meaning. Everything else is neutral. Blue is the accent for actions and current state. Emerald indicates folder/content categorization. Purple marks calendar events. No color appears without a role.

### Primary
- **Workspace Blue** (#3b82f6 / blue-500): Primary accent. Active navigation, primary buttons, current selections, link text, focus rings. The only blue on screen should mean "you can interact with this" or "this is selected." Used on ≤10% of any given screen.

### Secondary
- **Folder Emerald** (#10b981 / emerald-500): Semantic color for folder and content-tag categorization. Folder badges in browse, content-tag badges, active folder filters. Never used for actions or primary CTAs.

### Tertiary
- **Calendar Purple** (#8b5cf6 / purple-500): Semantic color for calendar-related elements. Calendar event badges, date highlights, participant indicators in calendar context. Never used outside calendar/time references.

### Neutral
- **Deep Surface** (#18181b / zinc-950): Body background, sidebar background. The deepest tone. All other surfaces float above this.
- **Card Surface** (#1c1c20): Elevated cards and containers. A single step above the base, warm-tinted. Not a different hue; a brightness step.
- **Subtle Border** (#2d2d33 / zinc-800/60 → now opaque): Default borders between regions. Visible structure, not decoration.
- **Hover Border** (#3f3f46 / zinc-700): Border state on card hover and interactive element focus. The only border color shift in the system.
- **Primary Text** (#e4e4e7 / zinc-200): Headings, titles, and body text. High contrast for long reading sessions. Minimum contrast ratio 12.5:1 on zinc-950.
- **Secondary Text** (#a1a1aa / zinc-400): Labels, metadata, timestamps. Supporting information. Contrast ratio 7.5:1 on zinc-950.
- **Muted Text** (#71717a / zinc-500): Placeholder text, disabled states, tertiary labels. Contrast ratio 4.7:1 on zinc-950.

### Named Rules

**The One Accent Rule.** Blue (#3b82f6) is the single interaction accent. It marks active states, primary actions, and focus rings. Its rarity is the point. If blue appears, something is clickable, selected, or current. If blue is used decoratively, it's wrong.

**The No Decoration Rule.** Emerald and purple encode category meaning (folder vs calendar). They never appear as background gradients, text gradients, or glow effects. Badge backgrounds use 12% opacity fills, not full saturation.

## 3. Typography

**Body Font:** Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif
**Label Font:** Same family. No display pairing. One family carries everything. Inter is the common cross-platform default for a reason: it's legible at every size and doesn't call attention to itself.

**Character:** Clean, functional, invisible. The type system serves information density without feeling dense. Weight contrast creates hierarchy; size contrast is moderate.

### Hierarchy
- **Title** (700, 1.5rem/24px, line-height 1.2): Page headings, section leaders. The heaviest weight in the system.
- **Heading** (600, 1.125rem/18px, line-height 1.3): Card titles, subsection headers.
- **Body** (400, 0.875rem/14px, line-height 1.5): Default body text, descriptions, metadata. Capped at 65-75ch for prose sections.
- **Label** (500, 0.75rem/12px, letter-spacing 0.05em, uppercase optional): Badge text, section headers, axis labels, category labels.

### Named Rules

**The Weight Hierarchy Rule.** Title (700) → Heading (600) → Body (400) → Label (500). Each step has a weight change of ≥100. Never use gradient text, color transitions, or text-shadow to create hierarchy. Weight and size are the only tools.

## 4. Elevation

Flat by default. No backdrop blur. No glass sheen. No shadow on cards at rest.

Depth is conveyed through brightness steps on the same neutral axis: the body is darkest (zinc-950), cards are one step brighter (custom surface-elevated), and borders mark boundaries. Cards on hover shift their border color, not their shadow.

The only shadows in the system are functional: image thumbnails and modals. Card hover shifts border color from zinc-800 to zinc-700. That's the entire elevation vocabulary.

### Shadow Vocabulary
- **Card rests on no shadow.** Flat on the base surface. Border-default separates it from the background.
- **Card hover shifts border** from `#2d2d33` to `#3f3f46`. No shadow change.
- **Modal/overlay shadow** (`0 10px 15px -3px rgba(0,0,0,0.5)`): For overlays, lightboxes, and the mobile sidebar backdrop. Used sparingly.

### Named Rules

**The Flat Surface Rule.** Cards are flat at rest. Elevation is communicated through brightness steps and border color, never through shadow, blur, or transparent layering. The only shadows serve overlays and modals.

## 5. Components

### Buttons
- **Shape:** Rounded (0.75rem), inline-flex, gap-2 for icon+text
- **Primary:** Workspace Blue background (#3b82f6), white text, px-4 py-2. On hover: lighter blue (#60a5fa). Focus: 2px ring offset by 2px, ring color blue-500, offset background zinc-950.
- **Secondary:** Elevated surface background (#1c1c20), zinc-200 text, 1px border zinc-700. On hover: zinc-700 background. Focus: zinc-600 ring.
- **Ghost:** Transparent background, zinc-500 text. On hover: zinc-800/50 background, zinc-200 text. Focus: zinc-600 ring.
- **Danger:** Red-600 background, white text. On hover: red-500.
- **Loading state:** Disabled opacity 50%, Loader2 spinner icon animating.
- **Disabled:** opacity-50, cursor-not-allowed.

### Chips / Filter Buttons
- **Shape:** Rounded (0.375rem for sm, 0.75rem for md), inline-flex, font-medium
- **Active:** Workspace Blue at 12% opacity background (#3b82f6/12), blue-400 text, blue-500/20 border. data-active="true".
- **Inactive:** Elevated surface background, zinc-500 text, zinc-700 border.
- **Semantic variants:** Folder emerald and Calendar purple active states use their respective colors at 12% opacity with corresponding text colors.
- **Focus:** 2px ring, accent color, 2px offset.

### Cards / Containers
- **Corner Style:** 0.75rem (12px)
- **Background:** #18181b (surface-primary), opaque, no blur
- **Shadow Strategy:** None at rest. Hover shifts border only.
- **Border:** 1px solid #2d2d33 (subtle border) at rest. 1px solid #3f3f46 (hover border) on hover.
- **Internal Padding:** 1.25rem (20px) for content, px-5 py-4 for headers/footers
- **No pseudo-element sheen.** No `::before` gradient overlay. No `backdrop-filter: blur`.

### Inputs / Fields
- **Style:** 1px border zinc-800, zinc-900/80 background, 0.5rem rounding. Text: zinc-100. Placeholder: zinc-500.
- **Focus:** border shifts to blue-500/50, 2px ring blue-500/20, offset by background.
- **Error:** border shifts to red-500/50, ring red-500/20 on focus.
- **Labels:** zinc-400, text-sm, font-medium, mb-1.5 above input.

### Navigation
- **Sidebar:** Fixed on desktop (w-64), slide-over on mobile. Same surface as body (zinc-950). Right border zinc-800/60 separating from content.
- **Nav items:** Flex row, items-center, gap-3, px-3, py-2.5, rounded-lg. Default state: zinc-400 text, zinc-500 icons. Active: single solid blue-600/15 background, blue-400 text and icons, blue-500/25 border (1px all sides, not just left). No gradient, no glow.
- **Active indicator:** Solid tint background + border all around. Not a left-stripe or gradient.
- **Mobile:** Hamburger button fixed top-left, backdrop overlay, slide-in sidebar with escape-to-close.

### InfoCard (formerly StatCard)
- **Layout:** Value above label. No icon container. No gradient on the value. Value: text-2xl font-bold text-zinc-100. Label: text-sm text-zinc-500. Optional trend arrow next to the value.
- **Background:** Card surface with card-hover behavior.
- **No decorative glow, gradient, or icon circle.** Value size and weight create hierarchy.

### Section Headers
- **Title:** text-2xl font-bold text-zinc-100. Solid color. No gradient clip.
- **Description:** text-sm text-zinc-500 mt-1. Optional.
- **Action slot:** right-aligned on desktop.

## 6. Do's and Don'ts

### Do:
- **Do** use solid opaque surfaces for all cards and containers. Background: opaque #18181b or #1c1c20, border: opaque #2d2d33.
- **Do** use Workspace Blue (#3b82f6) exclusively for interactive accent: active states, primary buttons, focus rings, and current navigation.
- **Do** create hierarchy through font weight (700→600→400→500) and size contrast, not through color gradients.
- **Do** ensure all body text meets WCAG AAA contrast (zinc-200 on zinc-950 = 12.5:1).
- **Do** use the same filter chip pattern everywhere: opaque background tint + text color + border, with data-active toggle.
- **Do** use consistent border color shifts for card hover (zinc-800 → zinc-700), not shadow changes.
- **Do** add skip-to-content links and aria-current="page" on active navigation.
- **Do** add focus-visible outlines (2px ring, accent color) on all interactive elements.

### Don't:
- **Don't** use `backdrop-filter: blur()`, `::before` sheen gradients, or semi-transparent card backgrounds. Cards are opaque. PRODUCT.md anti-reference: "SaaS dashboard cliché — glassmorphism."
- **Don't** use `background-clip: text` with gradients on any text element. Headlines, stat values, and labels use solid colors. PRODUCT.md anti-reference: "gradient text."
- **Don't** use `border-left` or `border-right` wider than 1px as colored accent stripes on cards, list items, or callouts. PRODUCT.md anti-reference: "side-stripe borders."
- **Don't** use hero-metric layouts (large number, small label, supporting stats, gradient/glow accent). Use value-above-label with weight contrast instead. PRODUCT.md anti-reference: "hero-metric template."
- **Don't** use decorative glow (`drop-shadow`, `box-shadow` with blue/purple spread) on logos, icons, or active elements. Glow is not information.
- **Don't** use more than three semantic colors (blue, emerald, purple) for meaningful encoding. Zinc neutrals carry everything else.
- **Don't** use different active-state styles for the same interaction across pages. If a filter chip looks different on Search vs Browse vs Tags, one is wrong.
- **Don't** use `#000` or `#fff`. Tint every neutral toward the workspace palette.
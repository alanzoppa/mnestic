# Product

## Register

product

## Users

A single knowledge worker managing ~2,000 personal notes — meeting notes, project logs, journal entries, scanned handwriting, and calendar events. They use Mnestic to recall what they've written, find connections between ideas, and browse their archive. Usage happens in short focused sessions (looking up a note) and longer exploratory sessions (browsing tags, tracing connections). They may be in a dim room late at night or a bright office during the day. The interface must respect both.

## Product Purpose

Mnestic is a private, local-first knowledge browser. It surfaces patterns, connections, and forgotten notes through semantic search, tag exploration, timeline views, and similarity graphs. Success is measured by how quickly and confidently a user finds what they're looking for — or discovers something they didn't know they were looking for. The UI should disappear into the task.

## Brand Personality

Quiet. Competent. Warm.

Not flashy, not cold. Like a well-made notebook that opens flat and stays out of your way. The warmth comes from readability and craft, not decoration. Every design choice should feel intentional and unhurried — the confidence of something built for use, not display.

## Anti-references

- SaaS dashboard cliché: no gradient hero metrics, no glassmorphism, no "modern dark mode" templates with blue/purple gradients, no hero-metric big-number cards
- Consumer social / feed aesthetic: no infinite scroll, no engagement metrics, no "delightful" micro-animations that interrupt flow
- Enterprise admin panels: no dense data tables with chrome-over-content, no corporate blandness
- Any interface where you can tell an AI generated the visual choices without reading the code

## Design Principles

1. **Stay out of the way.** The best interface for recalling a note is one you don't notice. Reduce visual noise to the minimum that still communicates structure. If removing something doesn't make the interface harder to use, remove it.

2. **Earn every accent.** Color, weight, and size are information. One accent color carries primary actions and current state. A second semantic color for success/folder tags. A third for calendar events. Nothing decorative. If a color doesn't encode meaning, it doesn't belong.

3. **Warm through craft, not decoration.** Readability, comfortable spacing, and consistent rhythm create warmth. Gradient text, glowing borders, and glass effects create the opposite — the "try-hard design" that signals generic rather than personal.

4. **Work in any light, any session.** The dark theme must have enough contrast for long reading sessions. The structure must be scannable in a 30-second lookup and comfortable in a 30-minute browse. Neither context gets priority; both must work.

5. **Consistency is affordance.** The same interaction pattern should look the same everywhere. Filter chips, active states, and navigation indicators follow one visual vocabulary. If "active" looks different on two pages, one is wrong.

## Accessibility & Inclusion

- WCAG AA minimum, targeting AAA for text contrast where feasible
- Keyboard navigation for all interactive elements (filter chips, calendar cells, graph nodes, note cards)
- Reduced motion respected (already in globals.css, verify all components comply)
- Screen reader compatibility: semantic HTML, aria-current on active nav, aria-labels on interactive cards
- Skip-to-content link for keyboard users
- Color never the only indicator of state
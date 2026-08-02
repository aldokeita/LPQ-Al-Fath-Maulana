# LPQ Aurora Neo-Glass

## Visual thesis

LPQ Al-Fath Maulana uses a warm, professional Islamic education interface with frosted translucent surfaces, aurora teal–cyan–blue–violet lighting, soft neumorphic depth, and clear information hierarchy. Decorative effects must support comprehension and never replace live data or semantic controls.

## Core tokens

- Color: use the semantic HSL variables in `src/index.css` (`background`, `foreground`, `card`, `primary`, `secondary`, `accent`, `muted`, `border`, `ring`, and attendance status tokens).
- Typography: Poppins for body copy, Montserrat for headings, Outfit for data-forward accents, and Cinzel only for selected institutional display text.
- Spacing: use the existing Tailwind 4 px scale; dashboard tables use compact 12–16 px cell padding.
- Radius: `--radius` is the base; inner badges use a tighter radius than their parent card.
- Depth: glass surfaces combine translucent backgrounds, a subtle inner/light border, backdrop blur, and tinted shadows.
- Motion: 200–300 ms for hover/focus feedback; animate only transform and opacity and honor reduced motion.
- Focus: every interactive control keeps a visible `ring`-token focus state.

## Dashboard layout contract

- The page owns vertical scrolling; wide data tables may own horizontal scrolling inside their card.
- Data remains readable at 375, 768, and 1280 px without clipping primary controls.
- Numeric values use tabular figures and explicit labels.
- Loading, empty, error, and success states remain understandable without relying on color alone.

## Reused primitives

- Dashboard data card: semantic `Card` shell with a restrained gradient header and scroll-safe table body.
- Status badge: compact text plus icon/color token, always with a readable status label.
- Metric badge: compact, tabular numeric value with a descriptive label for assistive technology.

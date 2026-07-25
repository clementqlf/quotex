# Penumbra Design System

Quiet interfaces, made luminous. A framework-agnostic CSS design system prioritizing accessibility (WCAG AA) and a small, restrained vocabulary.

## Colors

The palette is monochromatic by design, spanning 7 tokens from Obsidian to Beacon (warm white). Hue is replaced with value, ensuring layouts stay calm at low ambient brightness. Hierarchy emerges from elevation, not color.

- **Background** (Obsidian): `#08080a`
- **Surface** (Graphite): `#101013` (Used for Atmosphere cards and primary surfaces)
- **Surface Inset** (Slate): `#17171c` (Used for sidebars and input fields)
- **Border Hairline**: `#23232a` (Every divider is a single pixel. Emphasis lives in value, never in weight)
- **Primary / Accent** (Beacon): `#e8e5dc` (A single warm-white token powering every primary action, focus ring, and checked state)
- **Text Primary**: `#e8e5dc`
- **Text Secondary**: `#a0a0a5` (Inferred for muted text and timestamps)

## Typography

Three families are used to balance editorial elegance with dense product UI. Primary body type clears WCAG AA at 19:1.

- **Display**: `Instrument Serif`, serif (Sets editorial display copy and italic emphasis)
- **Body**: `Inter`, sans-serif (Handles every piece of dense product UI without competing)
- **Monospace**: `JetBrains Mono`, monospace (For code blocks and technical data)

## Layout and Spacing

- **Surface Tiers**: Obsidian, graphite, and slate step up in six-percent value increments.
- **Borders**: All borders and dividers are strictly 1px hairlines (`1px solid #23232a`).

## Components

### Atmosphere Card
- **Description**: The signature focal surface that carries the system's mood without crowding the page.
- **Visuals**: A dotted medallion over a clouded vignette.
- **Implementation**: Built with a CSS dot grid masked into a radial vignette (no images, no SVGs).

### Buttons (Pill Control)
- **Height**: 40px
- **Shape**: Pill-shaped (fully rounded).
- **Variants**: Primary, Secondary, Ghost.
- **Environment**: Buttons sit on a slate field with a hairline border.

### Inputs & Controls
- **Style**: Inputs, search bars, and checkboxes sit on a slate (`#17171c`) field with a hairline border (`#23232a`).
- **States**: Focus brings the warm-white accent up by exactly one pixel. Focus rings ship in the base layer.
- **Tabs**: Tab focus state inherits the warm-white underline.

## Accessibility & Motion
- **WCAG**: Accessible by default.
- **Motion**: Motion-reduced behavior (`prefers-reduced-motion`) is implemented in the base layer.

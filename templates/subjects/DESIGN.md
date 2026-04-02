# Design System Specification: The Sentinel Oversight

## 1. Overview & Creative North Star
**Creative North Star: "The Digital Panopticon"**

This design system moves away from the "clunky enterprise" aesthetic to embrace a high-end, editorial approach to Role-Based Access Control (RBAC). In the world of security, clarity is safety. We reject the "flat grid" of traditional dashboards in favor of **Tonal Layering** and **Atmospheric Depth**. 

By utilizing sophisticated, overlapping surfaces and intentional asymmetry, we create a "Digital Panopticon"—a space where the user feels they have total, effortless visibility over a complex ecosystem. The goal is to make technical data feel like a curated gallery of insights rather than a spreadsheet, establishing an immediate sense of high-trust and authoritative precision.

---

## 2. Colors
Our palette is rooted in the deep, nocturnal hues of the `background` (#0b1326), punctuated by the crystalline clarity of the `primary` blue (#adc6ff).

### The "No-Line" Rule
**Borders are an admission of failure.** To maintain a premium feel, designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts or tonal transitions.
*   *Implementation:* Use `surface_container_low` for a sidebar sitting against a `surface` main content area. The eye perceives the edge through the shift in luminance, not a harsh stroke.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of semi-translucent materials. 
*   **Base:** `surface` (#0b1326) – The foundation.
*   **Sub-sections:** `surface_container_low` (#131b2e).
*   **Primary Interaction Cards:** `surface_container` (#171f33).
*   **Active/Elevated Elements:** `surface_container_highest` (#2d3449).
*   **The Depth Rule:** Each inner container must use a *higher* tier than its parent to "lift" towards the user.

### The "Glass & Gradient" Rule
To elevate CTAs and global status indicators, use `surface_tint` at 8% opacity with a `backdrop-filter: blur(12px)`. For primary actions, apply a subtle linear gradient from `primary` (#adc6ff) to `on_primary_container` (#357df1) at 135 degrees to add "soul" and dimension.

---

## 3. Typography
We utilize **Inter** as our typographic anchor. It is the language of technical modernism.

*   **Display (lg/md/sm):** Used for high-level security posture numbers (e.g., "99.8% Secure"). Set with -0.02em letter spacing to feel "locked-in" and authoritative.
*   **Headline (lg/md/sm):** Reserved for page titles and major module headers. Use these to create asymmetrical focal points—don't always center them; let them lead the eye from the top-left.
*   **Title (lg/md/sm):** For data grouping and card headers. These act as the "Signposts" of the system.
*   **Body (lg/md):** All technical descriptions. Maintain a line height of 1.5 to ensure readability during high-stress monitoring.
*   **Label (md/sm):** Used for micro-data, timestamps, and metadata. Use `on_surface_variant` (#c6c6cd) to create a clear hierarchy against body text.

---

## 4. Elevation & Depth
In this system, elevation is a product of light and tone, not structure.

*   **Layering Principle:** Place `surface_container_lowest` (#060e20) cards on a `surface_container_low` (#131b2e) background to create a "recessed" look for logs, or vice-versa to create "lift."
*   **Ambient Shadows:** For floating modals, use a shadow with a 40px blur, 0px spread, and 8% opacity. The color must be a tinted version of the `primary_container` (#00163a), never pure black.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility in complex data tables, use `outline_variant` (#45464d) at **15% opacity**. It should be felt, not seen.
*   **Glassmorphism:** Navigation sidebars should utilize `surface_container_low` with a 60% opacity and 20px blur. This allows the "glow" of background graph visualizations to bleed through, creating a sense of environmental continuity.

---

## 5. Components

### Data Tables & Logs
*   **Forbid Dividers:** Do not use lines between rows. Use `Spacing 4` (0.9rem) of vertical padding.
*   **Zebra Striping:** Use `surface_container_low` for even rows and `surface_container` for odd rows to guide the eye across wide RBAC permission sets.

### RBAC Graph Visualizations
*   **Nodes:** Use `primary` for users, `tertiary` for assets.
*   **Edges (Connections):** Use `outline_variant` at 30% opacity. If a path is "Blocked" or "Anomalous," use `error` (#ffb4ab) with a subtle outer glow (neon effect).

### Action Chips
*   **Status Chips:** Use `tertiary_container` for "Safe" (Green-tinted), `on_secondary_container` for "Warning" (Amber-tinted), and `error_container` for "Critical."
*   **Radius:** Always use `roundedness.full` (9999px) for chips to contrast against the `md` (0.375rem) radius of data containers.

### Input Fields
*   **State:** Use `surface_container_highest` as the field background. No bottom line. Use `primary` for the focus ring (Ghost Border style).
*   **Labels:** Always use `label-md` floating above the input, never placeholder text alone.

### Sidebars & Navigation
*   **Asymmetry:** The sidebar should be wider than standard (280px+) to allow for `Title-lg` typography, creating an editorial, "heavy-left" layout that feels premium.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `Spacing 10` and `Spacing 12` to create "Breathing Room" between unrelated data clusters.
*   **Do** use `tertiary` (#6bd8cb) for "Success" states—its minty hue is more sophisticated than a standard lime green.
*   **Do** overlap elements (e.g., a floating search bar that slightly overlaps a data table header) to break the "grid" feel.

### Don't
*   **Don't** use 100% white text. Use `on_surface` (#dae2fd) to reduce eye strain in dark environments.
*   **Don't** use sharp corners. Stick to the `md` (0.375rem) or `lg` (0.5rem) scale to keep the "Technical" vibe from feeling "Hostile."
*   **Don't** use drop shadows on buttons. Use color shifts (`primary` to `primary_fixed_dim`) to indicate press states.
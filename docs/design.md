---
name: Corporate Clarity
colors:
  surface: '#faf8ff'
  surface-dim: '#dad9e1'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3fa'
  surface-container: '#eeedf4'
  surface-container-high: '#e9e7ef'
  surface-container-highest: '#e3e1e9'
  on-surface: '#1a1b21'
  on-surface-variant: '#444651'
  inverse-surface: '#2f3036'
  inverse-on-surface: '#f1f0f7'
  outline: '#757682'
  outline-variant: '#c5c5d3'
  surface-tint: '#4059aa'
  primary: '#00236f'
  on-primary: '#ffffff'
  primary-container: '#1e3a8a'
  on-primary-container: '#90a8ff'
  inverse-primary: '#b6c4ff'
  secondary: '#516070'
  on-secondary: '#ffffff'
  secondary-container: '#d5e4f8'
  on-secondary-container: '#576676'
  tertiary: '#4b1c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#6e2c00'
  on-tertiary-container: '#f39461'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b6c4ff'
  on-primary-fixed: '#00164e'
  on-primary-fixed-variant: '#264191'
  secondary-fixed: '#d5e4f8'
  secondary-fixed-dim: '#b9c8db'
  on-secondary-fixed: '#0e1d2b'
  on-secondary-fixed-variant: '#3a4858'
  tertiary-fixed: '#ffdbcb'
  tertiary-fixed-dim: '#ffb691'
  on-tertiary-fixed: '#341100'
  on-tertiary-fixed-variant: '#773205'
  background: '#faf8ff'
  on-background: '#1a1b21'
  surface-variant: '#e3e1e9'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 64px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style
The brand personality is professional, reliable, and human-centered. This design system facilitates high-stakes administrative tasks (employment certification) by reducing cognitive load and conveying a sense of institutional stability and personal care.

The design style is **Modern Corporate Minimalism**. It leverages a card-based architecture to organize information into digestible units, utilizing generous whitespace to ensure the user never feels overwhelmed by data. The interface feels light and breathable, prioritizing legibility and a clear path to completion for every request.

## Colors
The palette is rooted in a professional "Soft Blue" spectrum. 

- **Primary Deep Blue** is used for critical actions, navigation headers, and brand identity to evoke trust.
- **Secondary Light Blue** serves as a soft background for sections or a gentle highlight for active states.
- **Surface & Background** colors use a cool-gray-blue tint (#F8FAFC) to differentiate from pure white (#FFFFFF) cards, creating a subtle layered effect.
- **Functional Colors** (Success, Warning, Danger) are used sparingly for status badges and validation to maintain the calm atmosphere of the application.

## Typography
We use **Inter** for its exceptional legibility and systematic, utilitarian feel. It bridges the gap between a corporate institutional look and a modern SaaS experience.

- **Headlines:** Use SemiBold (600) or Bold (700) weights with slight negative letter-spacing to create a strong, grounded visual anchor.
- **Body Text:** Standardized on 16px for optimal readability across all ages and accessibility needs.
- **Labels:** Small labels use uppercase tracking for metadata and status indicators, ensuring they are distinct from standard body text.

## Layout & Spacing
The design system employs a **Fixed Grid** philosophy for desktop screens to maintain a professional, document-centric feel, while transitioning to a fluid layout for mobile.

- **Desktop:** 12-column grid centered within a 1200px container.
- **Tablet:** 8-column grid with 24px margins.
- **Mobile:** 4-column grid with 16px margins.

Spacing follows an 8px rhythmic scale. Generous internal padding (24px to 32px) within cards is required to maintain the "Modern Minimal" aesthetic and avoid a cramped, "spreadsheet" feeling.

## Elevation & Depth
Depth is created through **Tonal Layers** supplemented by **Subtle Ambient Shadows**.

- **Level 0 (Background):** #F8FAFC. The canvas on which the app sits.
- **Level 1 (Cards/Surfaces):** Pure #FFFFFF with a very soft, diffused shadow (0px 2px 4px rgba(30, 41, 59, 0.05)). This makes the cards appear slightly lifted from the background without being heavy.
- **Level 2 (Modals/Popovers):** Higher contrast shadow (0px 10px 15px rgba(30, 41, 59, 0.1)) to focus user attention on the task at hand.
- **Interactions:** On hover, cards should transition to a slightly deeper shadow or a thin 1px border using the Primary color at 10% opacity.

## Shapes
The system uses a consistent **8px (0.5rem)** corner radius for almost all components—including cards, input fields, and buttons. 

- **Small elements:** Tags and chips use a "Pill" (100px) radius to distinguish them from actionable buttons.
- **Consistency:** Avoid mixing sharp and rounded corners. Every interactive element should feel approachable and soft.

## Components

### Buttons
- **Primary:** Deep Blue background, White text. High contrast for main actions like "Submit Request."
- **Secondary:** Light Blue background, Primary Blue text. Used for "Save Draft" or "Cancel."
- **Ghost:** No background, Muted text. Used for less frequent actions or navigation.

### Status Badges
Status badges use a light background (10% opacity of the functional color) and a dark text of the same hue:
- **Draft:** Gray/Muted colors.
- **Submitted:** Primary Blue.
- **In Review:** Warning Amber.
- **Approved:** Success Green.
- **Rejected:** Danger Red.

### Cards
Cards are the primary container. They must feature a white background, the 8px border radius, and the subtle Level 1 shadow. Header sections within cards should be separated by a thin #E2E8F0 divider.

### Input Fields
Inputs use a white background with a #E2E8F0 border. On focus, the border transitions to Primary Blue with a 3px soft outer glow (the same Primary Blue at 10% opacity).

### List Items
Requests listed in a dashboard should be treated as "Row Cards" with horizontal padding and a subtle hover state to indicate clickability.
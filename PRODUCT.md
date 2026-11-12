# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

The primary audience is older women and adult relatives in Mexican families, confirmed by the user on November 12, 2026. People contribute family recipes, cook from them, and preserve who a recipe belongs to and the family story behind it. Support relatives with different levels of comfort using apps.

## Product Purpose

Family Recipe Tree / Recetario Familiar is a private family recipe app organized around people, families, and family branches. Successful use means a relative can find, contribute, read, and preserve a recipe while retaining its authorship and appropriate family access.

## Operating Context

A native Expo / React Native application for Android and iOS, with web support in the repository. Android APKs are the current hands-on testing workflow. Spanish is the default; English is supported. Recipe text and family names remain exactly as entered.

## Capabilities and Constraints

- Identity, ownership, visibility, and lineage are distinct concepts.
- Linked accounts and managed relatives share the person model; ownership is not inferred from the entering account.
- Family and branch access and administrative powers are server-authorized.
- Keep all existing recipe, people, family, authentication, confirmation, and audit behavior during a visual redesign.
- Media, collections, sharing, and preservation additions are tracked separately in PR #22; check its current merge state before implementation.
- This design task explores palettes and typography; no visual option is selected yet.

## Brand Commitments

The user requests a Mexican identity and a palette that feels directed toward family. The current generic presentation is a rejected aesthetic reference. The identity should serve older women and adult relatives. Exact colors and font families remain open decisions.

## Product Principles

- Family recipes and the people behind them are the main content.
- Reading and contributing a recipe must feel approachable.
- Clear ownership, sharing, and audit explanations must survive a visual change.
- Preserve native navigation, control behavior, accessibility, and localization.

## Accessibility & Inclusion

Prioritize comfortable recipe reading and explicit, understandable controls for older adults. The redesign must accommodate system text scaling, Spanish diacritics, English, distinguishable numerals and ingredient fractions. Detailed type and color decisions belong to the design exploration and the eventual approved system.

# FormRescue AI — Implementation Plan

## Product and implementation approach

Deliver a single-page static React + TypeScript app. The landing page leads directly into the Understand → Verify → Recover workspace. Its four sample reports are bundled local data; users can select one immediately, or browse, drop or paste an image for local preview, type an error and add optional context. The form does not submit data in demo mode. Uploaded images are validated and held in page memory; no OCR, AI analysis, server transfer, real-source retrieval or persistence is implemented.

Reports separate CONFIRMED, LIKELY and UNKNOWN. The coverage meter counts only directly supported findings in a fictional sample; it is not a probability of real-world correctness. Fictional portals and sources use stable internal IDs and a conspicuous label. Unavailable real requirements remain unknown. Checklist progress is component state. Copy, browser print/Save as PDF, language selection and speech use native browser APIs when supported.

Live AI is an opt-in status panel only. No provider, endpoint, key flow, source retrieval or connection test is configured. It states what remains to be connected and returns explicitly to the offline demo. Do not make a live request, claim OCR, imply a demo report came from an image, or fabricate official sources.

## Project structure

- `index.html`, `src/main.tsx`: document metadata, React entry and global stylesheet import.
- `src/App.tsx`: page composition, responsive experience, local state, fictional portal previews, evidence/checklist display, image editor, language/live-mode controls and report actions. Small presentational pieces are kept as local components alongside the single-page composition.
- `src/data/cases.ts`: four typed, bilingual fictional reports with stable demo source IDs, findings and recovery steps; `src/data/evaluations.ts`: ten fictional safety/evidence evaluation examples.
- `src/types.ts`: typed case, evidence, source, recovery and evaluation contracts.
- `src/i18n/strings.ts`: common English/Hindi labels, help text, FAQ and limitations.
- `src/services/analysis.ts`: file validation, redaction flattening, evidence coverage, speech text and privacy-conscious copy.
- `src/styles/global.css`: palette, layout, interaction states, responsive rules, focus styling, reduced-motion and print presentation.
- `src/App.test.tsx`, `src/services/analysis.test.ts`, `src/testSetup.ts`: interaction and utility tests.
- `public/manus-routes.json`, `public/formrescue-mark.svg`: route manifest and site mark.
- `README.md`: architecture, run/deployment, privacy, evaluation examples, actual test record and constraints.

## Design system

**Design movement:** calm editorial product design with a tactile evidence-workbench feel.

**Core principles:** make uncertainty visible; give one safe next action; keep user information local by default; explain official-rule gaps without shame or jargon.

**Color philosophy:** midnight navy provides steadiness, soft off-white lowers visual pressure, ownable deep indigo marks the product/action, amber marks plausible-but-unverified claims, green marks sample-supported facts and grey marks unknowns. Status is never communicated by color alone.

**Layout paradigm:** left-weighted editorial hero with a product-process illustration, followed by stacked full-width sections; inside the workspace, pair concise scenario selection with the screenshot/notice input, then let the report unfold vertically from summary to evidence to recovery actions.

**Signature elements:** the three-node Understand–Verify–Recover rail; label-plus-icon evidence chips; a fictional portal screen that resolves visually into a practical checklist.

**Interaction philosophy:** preview before action, plain status messages, reversible checklists/masks, explicit reset, and a visible escape from the unconfigured live mode. There is no fabricated loading or analysis state.

**Animation:** brief hover lifts and status transitions; restrained floating/scan details in the hero and demonstration portal; use CSS `prefers-reduced-motion` overrides; no animation is needed to understand a status.

**Typography system:** Space Grotesk heading preference with Inter/system sans fallbacks, and Noto Sans Devanagari/system fallbacks for Hindi. Keep body copy comfortably sized, headings tight and scannable, and evidence/support copy short with adequate line height. The app does not require remote font requests.

**Brand essence:** a careful recovery guide for people stuck on unfamiliar digital forms; calm, practical, candid.

**Brand voice:** reassuring but never certain without evidence. Example lines: “Let’s separate what the notice says from what we still need to check.” “Start with one safe next step.”

**Wordmark & logo:** “FormRescue” wordmark paired with an outlined page-corner and check mark, with a small amber signal detail; custom SVG used for site/platform identity.

**Signature brand color:** deep indigo `#4859C8`.

## Dependencies, serving and material constraints

Use Vite + React 18 + TypeScript with pnpm 11.25 and a frozen lockfile. Runtime Preview listens on port 3000. The deliverable is a static SPA (`dist`); no managed server, database, authentication or external API is required. `pnpm install --frozen-lockfile && pnpm build` creates the static output. No browser-side key, secret, user file or personal text is persisted. The app can build and demonstrate without a provider account; genuine screenshot reasoning and official-source verification remain explicitly unimplemented.

## Product outcomes

1. A responsive landing page with functional navigation, the exact requested headline, hero calls to action, process section, sample workspace, before/after, limitations, FAQ and hackathon footer.
2. Four complete bilingual fictional portals/reports with internally stable source IDs, the exact fictional-source label, accurate evidence categories and practical checklists.
3. Evidence coverage based on direct sample support, detailed uncertainty, missing information, verification guidance and current-session checklist progress.
4. Local image validation/preview/redaction/flattening/removal, optional category/jurisdiction/context, and privacy disclosures that never suggest image analysis.
5. Honest default offline demo and explicit unconfigured Live AI panel with no fake connection, key prompt, request, result or real citation.
6. English/Hindi UI and reports, simplified summaries, SpeechSynthesis controls, copy, print, feedback, reset and case switching.
7. Ten documented fictional evaluation examples, reproducible utility and interaction tests, project README and static hosting declarations.
8. Semantic/accessibility support, responsive reflow, keyboard focus, reduced motion, route manifest and project/site branding.

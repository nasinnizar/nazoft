# Flow button integration

The live CRM is Express + plain JavaScript, not React/Next.js. UI markup lives in
index.html and scripts/, with styles in styles/. The working FlowButton adaptation
uses styles/flow-buttons.css and a dynamic button decorator in scripts/settings-polish.js.
Existing handlers, form submission types, labels and disabled states are preserved.
Specialized controls (calendar cells, tabs, toggles, navigation and icon buttons)
are excluded from the moving-arrow layout. No stock imagery is needed.

flow-button.tsx is an optional React adapter, not part of the current build. It accepts
standard button props, including onClick, disabled, type, aria-label and className,
plus text. It reuses the live CSS rather than adding an unused icon dependency.

## If migrating to React later

Do this in a separate project; do not run a scaffold over this working CRM.
The [official shadcn Next.js setup](https://ui.shadcn.com/docs/installation/next)
uses `pnpm dlx shadcn@latest init -t next`. Choose TypeScript and configure Tailwind
using the generated scaffold or the [official Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
Use `components/ui` for reusable primitives and configure the `@/components/ui`
alias in components.json/tsconfig.json. This folder is a shadcn convention for
predictable imports and generated components, not a requirement of the current app.

Import the shared stylesheet from the React app's global styles entry and define
Nazoft theme tokens. For the original Lucide-based version, install `lucide-react`
inside that React project with `pnpm add lucide-react`. No React, Tailwind or Lucide
packages have been added to the current application because it does not execute TSX.

## Horizontal form pattern

`v-label-14.tsx` and the `v-label-14-utils/` primitives are the migration-ready
React/TypeScript version. In a future shadcn/Tailwind frontend, install the required
packages with `pnpm add @radix-ui/react-label class-variance-authority`, keep reusable
primitives in `components/ui`, and map `@/*` to the project root in `tsconfig.json`.
That folder matters because shadcn generators and the supplied imports expect this
convention.

The working CRM uses `styles/form-layout.css` and `scripts/form-layout.js` to apply
the same horizontal-label pattern to its existing HTML forms. Labels stack above
controls below 700px so lead, task, settings, and proposal forms remain usable on
phones. No images or context providers are required.

## Checkbox group pattern

`v-checkbox-group-8.tsx` and `v-checkbox-group-8-utils/` preserve the supplied
React/shadcn API for a future frontend migration. That future project should install
`@radix-ui/react-checkbox` and `lucide-react`. The live CRM deliberately does not
load those unused React dependencies; `styles/checkbox-groups.css` and
`scripts/checkbox-groups.js` provide the same accessible pattern for its existing
native checkboxes, including task rows, permissions, proposal review, exports, and
required-question controls.

## Alert pattern

The supplied light-alert styling is adapted to the live CRM in `styles/alerts.css`
and `scripts/alerts.js`. It provides semantic success, error, warning, and
information variants; fixed-size icons; dismiss controls; stacked announcements;
matching inline form feedback; and a consistent notification inbox. Existing
actions continue to call the shared `toast()` helper, so workflow behavior remains
unchanged. A future React frontend can place the supplied `alert-1.tsx` primitive
in this directory and install `lucide-react` and `class-variance-authority`; the
current runtime does not load unused React dependencies.

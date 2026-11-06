# Theme demo

A React, TypeScript, Vite, Tailwind CSS, and shadcn/ui app with your exported theme.

Use Node 24 or later. In this folder, run:

```sh
npm install
npm run dev
```

Open the URL printed by Vite. Use Dark mode or Light mode to switch themes. Add `?theme=dark` to start in dark mode.

The app includes every panel from the editor preview: project progress and actions, activity, project settings, and team members. Form values, notifications, project actions, and member removal use React state. These demo interactions reset on reload.

Edit colors in `src/theme.css`, the sample app in `src/App.tsx`, or the included components in `src/components/ui`. `components.json` configures shadcn/ui and the `@/` alias so you can add more components.

## Production build

```sh
npm run build
npm run preview
```

Deploy the generated `dist` folder to a static host. Assets use relative paths.

## Standalone previews

Open `preview/index.html` or `preview/dark.html` directly in a browser for a standalone snapshot of the editor's light and dark previews. They include compiled CSS and need no installation. Rebuilding the React app writes `dist`; export again from the editor to refresh these snapshots.

The shadcn/ui component sources come from [the official registry](https://ui.shadcn.com/r/styles/new-york/button.json). Their license is in `LICENSE.shadcn.md`.

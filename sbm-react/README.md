# sbm-react

The SBM frontend: React + Refine + Ant Design, served by the `jms` app at
`/sbm`. The plan, pages and API contract are in
[docs/REACT_FRONTEND_PLAN.md](../docs/REACT_FRONTEND_PLAN.md).

## Commands

| Command | What it does |
| --- | --- |
| `yarn install` | Install packages (versions are pinned) |
| `SBM_SITE=<site> yarn dev` | Dev server at http://localhost:8080/sbm/ and /login, API proxied to the local bench (`SBM_BENCH_URL`, default `http://127.0.0.1:8000`). Log in on the bench site first. Never point it at the live site |
| `yarn build` | Type check, then build `sbm.js` and `sbm.css` into `../jms/public/sbm` |
| `yarn lint` | ESLint, including the 200-line limit per file |
| `yarn test` | Vitest (unit tests) |
| `SBM_LIVE_URL=http://<site>:8000 SBM_LIVE_SID=<sid> yarn test` | Also runs the read-only live tests of the data provider against a site, as the user of that session (`sid` cookie from a logged-in browser). Use a test site |
| `yarn format` | Prettier |

`bench build --app jms` runs `yarn build:sbm` from the app root, so a deploy
needs no extra step.

## How it starts

1. `jms/www/sbm.html` sets `window.boot` (user, roles, company…) and
   `window.csrf_token`, then loads `sbm.js`.
2. On the dev server there is no `sbm.html`, so `src/lib/boot.ts` fetches the
   same data from `jms.api.boot.get_boot` (which also returns the CSRF token in
   developer mode).
3. `src/App.tsx` sets up Refine. Routes are full site paths: `/login` (the
   server shows this app there instead of the ERPNext login, see
   `jms/sbm_login.py`) and `/sbm/...`.

## Data

`src/providers/dataProvider.ts` connects Refine to Frappe with the standard API.
A Refine resource name is the DocType (`"Job Type"`), a record's `id` is its
Frappe `name`. Pass `meta: { fields: [...] }` to read only some fields in lists.
Custom calls: `useCustom({ url: "jms.api.jobs.list_jobs", method: "get" })`.

## Versions

React 18 and Ant Design 5 on purpose: `@refinedev/antd` 6 needs Ant Design 5,
and Ant Design 5 needs an extra patch package for React 19. `vite` is pinned
through `resolutions` so Vitest uses the same copy.

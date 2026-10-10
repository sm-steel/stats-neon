# stats-neon — design (2026-10-10)

Sub-project 6 of the profile neon restyle (see `sm-steel/neon-kit` `docs/specs/2026-10-10-neon-kit-design.md`).

## Context

The `sm-steel` profile still shows two third-party widgets that don't match the neon cards:
- **lowlighter/metrics:** profile header, repo stats, and a languages bar;
- **streak-stats.demolab.com:** total contributions, current streak and longest streak. It's dark-only, so it shows as a dark slab in light mode.

The user chose to replace both with **one `// SYS.STATS` card** from a **new reusable GitHub Action repo, `sm-steel/stats-neon`**, built like `contrib-neon`. Language colours come from a **Catppuccin ramp**: the top 8 by size, then a grey "Other".

## Action

- **Repo:** `sm-steel/stats-neon`. TypeScript with `@sm-steel/neon-kit` ^1.1.0 as the only runtime dependency, bundled by esbuild into a committed `dist/action.js`. `action.yml` uses `runs.using: node24`. The repo has a CLI, `dist/cli.js`, for local previews.
- **Inputs** (as in contrib-neon):
  - `github_user_name` (required);
  - `outputs` (required): lines like `dist/stats.svg?flavor=latte`;
  - `github_token` (default `${{ github.token }}`, which sees public data only, like the current widgets).
- **Per-output options:**
  - `flavor=latte|frappe|macchiato|mocha` (default `mocha`);
  - `languages=N`, 1–8 (default 8).
  - An unknown flavor or an out-of-range `languages` value is an error.
- **Failures:** API errors, unknown users and bad options make the action **fail the run** with a clear message. It never writes a broken SVG, so the previously published one stays in place.
- **Tooling:** mise (Node 24.21.0), Biome, Vitest, tsc.
- **CI:**
  - lint, typecheck, tests, and a check that `dist/` is current;
  - a self-test job that runs the action from the checkout against the repo owner and uploads the SVGs as an artifact.
- **Releases:** tag `v1.0.0` plus a floating `v1`. Marketplace listing is optional and later; the user does it in the web UI.

## Data (GitHub GraphQL, `https://api.github.com/graphql`, `Authorization: bearer <token>`)

1. **Profile and repos.** One query, paginated over repositories:
   ```graphql
   query($login: String!, $after: String) {
     user(login: $login) {
       login createdAt
       followers { totalCount }
       repositoriesContributedTo(contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]) { totalCount }
       repositories(ownerAffiliations: OWNER, first: 100, after: $after) {
         totalCount
         pageInfo { hasNextPage endCursor }
         nodes { isFork stargazerCount releases { totalCount } languages(first: 20) { edges { size node { name } } } }
       }
     }
   }
   ```
   - `user: null` fails with `GitHub user "<login>" not found`. GraphQL `errors` fail with their messages.
   - Pagination stops at **10 pages**, i.e. 1000 repos.
2. **Contributions.** One query with one alias per calendar year from the year of `createdAt` to the current year. Each alias is `yYYYY: contributionsCollection(from:, to:)`, where `from` is `createdAt` for the first year and `YYYY-01-01T00:00:00Z` otherwise, and `to` is `YYYY-12-31T23:59:59Z` (each range is at most one year, as the API requires). Each alias returns `contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } }`.

## Derived values

- **Days:** all `contributionDays` merged, deduplicated by date, sorted, and **cut at today (UTC)**, because year ranges include future days.
- **Total:** the sum of `totalContributions` over the years. **Since** is the first day with a count above 0, or `now` when there is none.
- **Current streak:** consecutive days with count > 0, ending **today**. If today is 0, they end **yesterday** instead (a grace day, so the streak doesn't reset before you've had a chance to contribute today). If both are 0, the streak is 0.
- **Longest streak:** the maximum run over all days. On a tie, the most recent run wins.
- **Ranges:** `Mon D – Mon D` (e.g. `Oct 1 – Oct 10`).
  - The year is added to each end that isn't in the current year (`Sep 12, 2025 – Sep 25, 2025`).
  - A one-day streak shows a single date.
  - A zero streak shows `—`.
  - The total shows `Jun 23, 2025 – now`.
- **Stats:**
  - `REPOS` = owned repos `totalCount`, forks included;
  - `CONTRIBUTED TO` = `repositoriesContributedTo.totalCount`;
  - `STARS` = Σ `stargazerCount` over owned repos;
  - `RELEASES` = Σ `releases.totalCount` over owned repos;
  - `FOLLOWERS`;
  - `JOINED` = account age as `NY` if 1 year or more, else `NMO` if 1 month or more, else `ND`.
- **Languages:** Σ `size` per language name over **non-fork** owned repos, sorted by size. The top `languages` (default 8) each get a percentage of the total. The rest are summed into `Other`, which is shown only if it's greater than 0. Percentages have 1 decimal.

## Rendering

- **Card:** neon-kit `card()`.
  - `title: "Sys.Stats :: @<login>"`, which the HUD shows uppercase as `// SYS.STATS :: @SM-STEEL`.
  - `font: { variant: "text", weights: [400, 700] }`, `seed: "stats:<login>"`, `label: "<login>'s GitHub stats"`.
  - Content width 868, so the outer width is 900.
- **Streak tiles:**
  - 3 tiles at y=0, each (868−20)/3 wide and 78 tall, with a 10px gap, `rx=2`, and a 1px `border` stroke.
  - Inside each: the value (26px bold, accent colour, with thousands separators) at y=32; the label (`Total Contributions`, `Current Streak`, `Longest Streak`; 13px, `text` colour) at y=52; the range (11px, `subtext` colour) at y=68. All centred.
- **Stats line:** baseline y=108, 12px, letter-spacing 1. `LABEL` is in the `subtext` colour, `value` in `text`, with ` · ` separators in the accent colour. Left-aligned.
- **Languages** (omitted when no language data):
  - `// LANGUAGES` sub-header at y=138 in the HUD style (10px, letter-spacing 1.2, `//` in the accent colour), with no cursor;
  - a bar at y=148, 10px tall, full width, clipped to `rx=2` (clip id `st-bar`), split into segments by percentage;
  - a legend in 4 columns (217px wide). Rows have baselines at y=178 and y=198. Each entry is a dot (r=4) plus `Name 62.3%` at 12px (name in `text`, percentage in `subtext`).
- **Content height:** up to the last legend row + 6, or 116 when the languages section is omitted.
- **Colours** (per flavor, Catppuccin accents): mauve, blue, teal, green, yellow, peach, red and pink for ranks 1–8; `Other` is `overlay0`. The palette table lives in stats-neon, because neon-kit's `Palette` doesn't include these accents.
- **Escaping:** all user-derived text (login, language names) goes through `esc()`.

## Profile integration (sm-steel)

- The existing `contrib-neon.yml` workflow gets a second step, `uses: sm-steel/stats-neon@v1`, with outputs `dist/stats.svg?flavor=latte` and `dist/stats-dark.svg?flavor=mocha`, placed **before** the single publish step. Both cards then share one `output` branch publish. Two workflows publishing to the same branch would wipe each other, because the publish action replaces the branch contents.
- **Remove** `metrics.yml`. In the README, replace the metrics `<img>` and the streak-stats `<img>` with one light/dark `<picture>` of `output/stats*.svg`.
- Leave the remote `output-metrics` branch in place unless the user asks to delete it.

## Testing

All tests run offline, using fixtures and a fake `fetch`:
- **Streaks:**
  - a run ending today;
  - today = 0 with the grace day;
  - today and yesterday = 0;
  - runs across a year boundary (Dec 31 → Jan 1);
  - longest-streak ties;
  - future days ignored;
  - duplicate dates across year aliases.
- **Total and since:** the sum over years; the first day with a contribution; no contributions at all.
- **Ranges:** formatting with and without the year, single day, zero.
- **Languages:** aggregation, forks excluded, top N plus Other, no Other when N covers everything, `languages=3`.
- **Stats:** account-age formatting at each boundary; sums over repos.
- **Fetching:** repo pagination with the cap; a year alias query built for each year since `createdAt`; user not found; GraphQL errors; HTTP errors.
- **Options:** flavor and languages parsing and their errors.
- **Render:**
  - tiles with values and ranges;
  - the stats line;
  - the bar segments' widths adding up to the full width;
  - legend rows for N = 1, 4, 5 and 8;
  - no languages section;
  - escaping;
  - the light flavor.

**Gates:**
- a local preview from the user's real data via the CLI with `gh auth token`, at GitHub README width in both themes, approved by the user;
- a fresh review;
- with the user's go-ahead: create the repo, push, CI, tag `v1`; then the profile switch;
- verify the published SVGs and the profile in both themes.

## Out of scope

- Private contribution counts beyond what the default token's public view shows.
- Packages, sponsors, forkers, watchers, disk usage, the "prefers license" line, and the 14-day mini strip from metrics.
- A Marketplace listing (optional later, done by the user in the web UI).

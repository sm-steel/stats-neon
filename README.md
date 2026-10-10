# stats-neon

A neon `// SYS.STATS` card for your GitHub profile, rendered as one animated SVG from GitHub's API:

- **Streaks:** total contributions since your first one, your current streak and your longest streak, each with its date range.
- **Stats:** repos, stars, forkers, watchers, repos contributed to, releases, packages, sponsors, followers, account age, your most-used license and disk used, each with its icon.
- **Languages:** how many you use, plus a bar and legend of your top ones by code size, in Catppuccin colours.

It's built with [@sm-steel/neon-kit](https://github.com/sm-steel/neon-kit), the same look as [contrib-neon](https://github.com/sm-steel/contrib-neon): Catppuccin panels, corner brackets, scanlines, a scan beam and occasional glitch tears.

## Usage

```yaml
name: profile cards

on:
  schedule:
    - cron: "0 0 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: sm-steel/stats-neon@v1
        with:
          github_user_name: ${{ github.repository_owner }}
          outputs: |
            dist/stats.svg?flavor=latte
            dist/stats-dark.svg?flavor=mocha

      # one publish step for everything in dist/
      - uses: crazy-max/ghaction-github-pages@v5
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

If you also use contrib-neon (or anything else that publishes to the same branch), put its step **in the same job** before the single publish step. The publish action replaces the whole branch, so two workflows publishing to one branch would delete each other's files.

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/<you>/<you>/output/stats-dark.svg" />
  <img alt="GitHub stats" src="https://raw.githubusercontent.com/<you>/<you>/output/stats.svg" width="100%" />
</picture>
```

## Options

Each `outputs` line is a file path with options as a query string:

| Option | Values | Default |
|---|---|---|
| `flavor` | `latte`, `frappe`, `macchiato`, `mocha` | `mocha` |
| `languages` | 1–8: how many languages get their own colour (the rest become "Other") | `8` |

Action inputs: `github_user_name` (required), `outputs` (required), and `github_token` (default: the workflow token, which sees public data, the same view a visitor has). GitHub may hide packages, sponsors or disk usage from the workflow token; those then show `—`. To fill them, pass a personal access token from a secret: `github_token: ${{ secrets.MY_TOKEN }}`.

## How streaks are counted

- Days are calendar days (UTC) from your GitHub contribution graph, from the day you joined to today.
- **Current streak:** consecutive days with at least one contribution, ending today. If today has none *yet*, it ends yesterday, so the streak doesn't drop to 0 before you've had the chance to contribute.
- **Longest streak:** the longest run in your whole history. On a tie, the most recent run wins.

If anything goes wrong (unknown user, API error, bad option), the action fails the run and writes nothing, so the previously published card stays up.

## Development

Tools are pinned with [mise](https://mise.jdx.dev): `mise install && npm ci`.

- `npm test`, `npm run lint`, `npm run typecheck`
- `node src/cli.ts --user <login> --out preview/out/stats.svg` renders a card locally (token from `$GITHUB_TOKEN` or `$GH_TOKEN`).
- `npm run build` bundles `dist/` (committed; CI checks it's current).

## License

MIT. The stat icons are [GitHub Octicons](https://github.com/primer/octicons) (© GitHub Inc., MIT License), embedded in `src/icons.ts`.

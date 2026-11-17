# Deploying

The site is published by GitHub Actions to GitHub Pages at <https://moving-maths.github.io>.

## One-time setup

1. In the `moving-maths` organisation, create a repository named exactly `moving-maths.github.io`. GitHub serves an organisation site from the repository with that name, at the root of the domain.
2. In the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push this project to the repository's `main` branch.

## What happens on push

`.github/workflows/deploy.yml` runs on every push to `main` (and can be started by hand from the Actions tab). The build job checks out the whole history (each page shows the date of its last commit), installs dependencies with `npm ci`, runs `npm test` (which includes a full build and the link check), installs Playwright's Chromium and runs `npm run test:browser` (every page in a browser), builds `dist/` and uploads it. The deploy job then publishes it. A failed test, a TeX error or a broken link stops the deploy, and the live site stays as it was.

- Pull requests run the build job only. Nothing is uploaded or deployed, and the workflow's token is read-only.
- Only the deploy job may write to Pages, and only on `main`.
- Deploys run one at a time, and one that has started is never cancelled, so the live site is never left half-published.

## Notes

- Drafts (`draft: true`) are never built for deployment.
- Thumbnails are not made in CI. Run `npm run thumbs` locally and commit the PNGs.
- If the site ever moves to a custom domain or a project path, change `url` in `site/site.yml`. All internal links are root-relative (`/slug/`), so a project path such as `/moving-maths/` would also need a base path in the templates.

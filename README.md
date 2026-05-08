# anica-landing-page

Static landing page for [Anica](https://github.com/LOVELYZOMBIEYHO/anica), built with Astro and Tailwind CSS for GitHub Pages.

## Pages

- `/` - Intro page
- `/showcase` - Workflow showcase
- `/download` - Source-only alpha download and build guidance

## Development

```sh
nvm use
npm install
npm run dev
```

This project expects Node `>=22.12.0`. The included `.nvmrc` points to Node `22.19.0`.

The dev server runs at `http://localhost:4321/` by overriding Astro base to `/` in the `dev` script.

The production config uses `base: /anica-landing-page` for GitHub Pages. If you want to inspect the deployed path locally, use `npm run preview` after building.

## Build

```sh
npm run build
npm run preview
```

## Deploy

GitHub Pages deployment is configured in `.github/workflows/deploy.yml`. In the repository settings, set Pages source to GitHub Actions.

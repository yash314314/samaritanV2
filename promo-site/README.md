# Samaritan Promotional Website

A high-performance static React promotional website for **Samaritan Activity Tracker**—the local-first desktop focus & productivity engineering system inspired by Rize.

---

## Overview & Architecture

This promotional website is built directly from verified capabilities and actual screenshots of Samaritan. It requires **zero backend servers at runtime** and compiles into pure static HTML, JavaScript, and CSS assets ready for deployment to Vercel, Netlify, Cloudflare Pages, GitHub Pages, or AWS S3.

- **Framework**: React 19 + TypeScript
- **Bundler**: Vite 8
- **Styling**: Tailwind CSS v4
- **Iconography**: Lucide React
- **Product Media**: 7 High-Resolution UI Captures located in `public/images/product/`
- **Interactive Features**: Client-Side Live Window Observer Simulator, 4-Level Deep Work Protocol Tester, and Procedural Web Audio Ambient Noise Synthesizer (Rain, Pink, White, Brown sound).

---

## Quick Start (Development)

From this directory (`promo-site`):

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```

Open `http://localhost:5173` to view the promotional site in development mode with HMR.

---

## Production Static Build

To generate deployment-ready static assets:

```bash
# Compile TypeScript and build static production bundle
npm run build
```

The production output will be generated inside:

```text
promo-site/dist/
├── index.html
└── assets/
    ├── index-*.css
    └── index-*.js
```

---

## Preview Production Build Locally

To test serving the built static assets locally:

```bash
npm run preview
```

Open `http://localhost:4173` to test the production build.

---

## Demo Environment & Data Regeneration

If you need to restart Samaritan locally or regenerate the synthetic demo dataset:

1. **Start PostgreSQL**:
   ```bash
   docker compose up -d postgres
   ```
2. **Apply Migrations**:
   ```bash
   cd api
   npx prisma migrate deploy
   ```
3. **Run Synthetic Demo Data Generator**:
   ```bash
   cd api
   npm run seed:demo
   ```
4. **Boot Samaritan**:
   - API: `cd api && npm run dev` (`http://localhost:4000`)
   - Dashboard: `cd dashboard && npm run dev` (`http://localhost:3000`)

---

## Deployment Instructions

To deploy this static website:
- **Vercel / Netlify / Cloudflare Pages**: Set root directory to `promo-site`, build command to `npm run build`, and output directory to `dist`.
- **S3 / Nginx / Static Server**: Copy contents of `promo-site/dist/` directly to your web server root.

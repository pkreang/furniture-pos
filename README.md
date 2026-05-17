# Furniture House POS

Production rebuild of the multi-branch furniture POS.
See `docs/superpowers/specs/` for the design and `docs/superpowers/plans/` for plans.
The original demo is preserved in `legacy-demo/` for reference only.

## Local development

1. `cp .env.example .env` and edit values.
2. `npm install`
3. `npm run db:up` — start PostgreSQL in Docker.
4. `npm run dev:api` and `npm run dev:web` in separate terminals.

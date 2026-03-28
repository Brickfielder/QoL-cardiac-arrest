# HRQoL CA Evidence Workspace

Private, Vercel-ready workspace for curating the HRQoL after cardiac arrest evidence base.

## Stack

- Next.js App Router + TypeScript
- Neon Postgres + Drizzle ORM
- Auth.js credentials auth
- Private Vercel Blob storage for PDFs

## Setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `DATABASE_URL`, `NEXTAUTH_SECRET`, and `BLOB_READ_WRITE_TOKEN`.
3. Run database setup:

```bash
npm install
npm run db:push
```

4. Seed the workspace from the repo artifacts:

```bash
npm run seed:repo
```

5. Optionally create or update user accounts:

```bash
npm run seed:users -- --email you@example.org --password strongpass --role admin
```

6. Start the app:

```bash
npm run dev
```

## Notes

- `ARTIFACTS_ROOT` defaults to `..` so the importer can read the parent repo artifacts from this app workspace.
- PDF uploads use the Vercel Blob client-upload flow so larger PDFs still work on Vercel.
- The canonical import baseline is the reconciled CSV set under `outputs/current/canonical_*`.

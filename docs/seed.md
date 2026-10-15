# Demo Data

Apply migrations first. In `.env.local`, set `SEED_USER_ID` to an existing user's UUID from **Supabase > Authentication > Users**. This does not create an auth account. Run:

```sh
npx prisma db seed
```

The seed uses `DIRECT_URL`, falling back to `DATABASE_URL`, with Prisma's PostgreSQL adapter. It creates **Online Banking App** for that user with 8 requirements, 6 stories, 10 tests, and 14 links. Initial coverage is 62.5%, with 3 uncovered requirements, 2 orphan tests, and 2 stories without requirements. REQ-004 has story-mediated coverage only. Sequence counters start at 8/6/10 so subsequent items receive REQ-009, US-007, and TC-011.

The demo project ID is stable per user. Seeding is transactional and concurrent runs are serialized. Rerunning leaves an existing demo completely unchanged, preserving edits and any new items. It does not reset or repair that project. To recreate the demo, deliberately delete it through the app and rerun the command. Other projects, including ones with the same name, are untouched.

The seed connects as the database role and bypasses RLS. Use a development/test database and the intended user's ID.

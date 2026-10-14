# Row Level Security

After running the Prisma migration, open your Supabase project dashboard,
choose **SQL Editor > New query**, paste the contents of
[`prisma/sql/rls.sql`](../prisma/sql/rls.sql), and click **Run** using the
`postgres` role. The script runs in a transaction and can be rerun: it drops
and recreates its named policies before committing.

The policies cover SELECT, INSERT, UPDATE, and DELETE on all five application
tables. Signed-in Data API requests use the `authenticated` role and
`auth.uid()`. Project access requires `owner_id = auth.uid()`; child rows
require ownership of their parent project. Updates check both the old and new
rows. Unauthenticated requests have no access under these policies.

Prisma connects using the Supabase `postgres` role (including pooled
`postgres.<project-ref>` credentials), which bypasses RLS. Prisma does not
automatically forward the user's JWT or set `auth.uid()`. RLS is therefore
defense-in-depth for the Supabase Data API, not authorization for Prisma.
App code must authenticate the user and scope every query and mutation to
projects they own. Set `owner_id` from the verified session, check ownership
when creating child rows, and validate that Link endpoints belong to that
same project.

The script replaces only its own named policies. Review any other policies on
these tables: permissive policies combine with OR and can grant broader access.
Test ownership with two signed-in users through the Data API; queries run as
`postgres` in the SQL editor bypass RLS and do not test these restrictions.

See the [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

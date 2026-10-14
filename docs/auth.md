# Email and password authentication

Visit `/signup` to create an account or `/login` to sign in. Passwords must
contain at least eight characters. A signed-in session redirects to
`/dashboard`; logout ends the current session and redirects to `/login`.

In Supabase Authentication > URL Configuration, set Site URL to your app's
origin (for local development, `http://localhost:3000`, or the port printed
by Next.js). Update it to the deployed origin for production.

If email confirmation is enabled, signup displays a confirmation message
instead of redirecting before a session exists. In Authentication > Email
Templates > Confirm signup, use this confirmation link:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>
```

The confirmation route verifies the token, sets session cookies, and redirects
to `/dashboard`. Invalid or expired links show an error page. With the default
email template, users can confirm their address and then log in manually.

`src/proxy.ts` refreshes cookies before routes render. The dashboard still
checks the user with `requireUser()`; the proxy does not replace authorization
in server actions or database queries.

See [Supabase's Next.js tutorial](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).

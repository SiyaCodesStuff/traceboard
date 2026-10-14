import Link from "next/link";

export default function ConfirmationErrorPage() {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Unable to confirm your email</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">This link may have expired or already been used. If you have already confirmed your address, log in with your email and password.</p>
      <Link href="/login" className="mt-5 inline-block text-sm font-medium underline underline-offset-4">Back to log in</Link>
    </main>
  );
}

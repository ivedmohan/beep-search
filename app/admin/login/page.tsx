type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) ?? "";
  const rawNext = one("next");
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/admin";
  const error = one("error") === "1";

  return (
    <div className="card w-full max-w-sm p-6 shadow-[var(--shadow-soft)]">
      <h1 className="display text-2xl">Admin login</h1>
      <p className="mt-1 text-sm text-muted">Internal tool for the Beep fresher-jobs pipeline.</p>
      <form action="/api/admin/login" method="post" className="mt-5 flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Password
          <input name="password" type="password" autoComplete="current-password" autoFocus required className="input" placeholder="ADMIN_PASSWORD" />
        </label>
        {error && (
          <p role="alert" className="rounded-[10px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Wrong password. Try again.
          </p>
        )}
        <button type="submit" className="btn-green mt-1 w-full">
          Sign in
        </button>
      </form>
    </div>
  );
}

import DeleteConfirmButton from './DeleteConfirmButton';

export default async function SettingsPage() {
  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <h1 className="text-xl font-semibold">Settings</h1>

      <form action="/api/account/export" method="GET">
        <button className="rounded border px-3 py-1">Export my data</button>
      </form>

      <form action="/api/account/delete" method="POST">
        <DeleteConfirmButton />
      </form>

      <form action="/api/auth/signout" method="POST">
        <button className="rounded border px-3 py-1">Sign out</button>
      </form>
    </main>
  );
}

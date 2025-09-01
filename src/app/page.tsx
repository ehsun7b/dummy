import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession, login, logout } from "@/lib/session";

export default async function Home() {
  const session = await getSession();

  async function loginAction(formData: FormData) {
    "use server";
    await login(formData);
    redirect("/");
  }
  async function logoutAction() {
    "use server";
    await logout();
    redirect("/");
  }

  const cookieStore = await cookies();
  const flash = cookieStore.get("flash")?.value || null;

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">Simple Cookie Auth Demo</h1>
      <p className="text-sm text-gray-600 mt-1">Public page with login/logout</p>

      <section className="mt-6">
        {!session?.user ? (
          <form action={loginAction} className="space-y-3">
            <div>
              <label className="block text-sm mb-1">Username</label>
              <input name="username" className="border rounded px-3 py-2 w-full" defaultValue="admin" />
            </div>
            <div>
              <label className="block text-sm mb-1">Password</label>
              <input type="password" name="password" className="border rounded px-3 py-2 w-full" defaultValue="password" />
            </div>
            <button className="px-4 py-2 rounded bg-blue-600 text-white">Login</button>
          </form>
        ) : (
          <form action={logoutAction}>
            <button className="px-4 py-2 rounded bg-gray-700 text-white">Logout</button>
          </form>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-semibold">Session</h2>
        <pre className="mt-2 rounded bg-gray-100 p-3 text-sm overflow-auto">{JSON.stringify(session, null, 2)}</pre>
        {flash && <p className="mt-2 text-green-700">Flash: {flash}</p>}
      </section>

      <section className="mt-6">
        <a href="/protected" className="text-blue-700 underline">Go to protected page →</a>
      </section>
    </main>
  );
}

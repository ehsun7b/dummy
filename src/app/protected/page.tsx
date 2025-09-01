import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function ProtectedPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const cookieStore = await cookies();
  const flashRaw = cookieStore.get("flash")?.value || null;
  let items: string[] = [];
  if (flashRaw) {
    try {
      const parsed = JSON.parse(flashRaw);
      if (Array.isArray(parsed)) {
        items = parsed.filter((x) => typeof x === "string");
      } else if (typeof parsed === "string") {
        items = [parsed];
      }
    } catch {
      // if it wasn't JSON, treat as a single string
      items = [flashRaw];
    }
  }

  async function saveAction() {
    "use server";
    const session = await getSession();
    if (!session?.user) redirect("/");
    const cookieStore = await cookies();
    // Read existing list
    const existing = cookieStore.get("flash")?.value || null;
    let list: string[] = [];
    if (existing) {
      try {
        const parsed = JSON.parse(existing);
        if (Array.isArray(parsed)) list = parsed.filter((x) => typeof x === "string");
        else if (typeof parsed === "string") list = [parsed];
      } catch {
        list = [existing];
      }
    }
    const entry = `Saved at ${new Date().toLocaleTimeString()}`;
    list.push(entry);
    // Cap to last 10 to keep cookie small
    if (list.length > 10) list = list.slice(-10);

    // Set a short-lived non-httpOnly flash list, renew expiry on save
    cookieStore.set("flash", JSON.stringify(list), {
      httpOnly: false,
      path: "/",
      maxAge: 60, // seconds
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    redirect("/protected");
  }

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">Protected</h1>
      <p className="mt-2">Hello, {session.user?.name}!</p>
      {items.length > 0 && (
        <div className="mt-4 rounded bg-green-100 text-green-900 p-3">
          <p className="font-medium mb-2">Saved items</p>
          <ul className="list-disc ml-5 space-y-1">
            {items.map((it, idx) => (
              <li key={idx}>{it}</li>
            ))}
          </ul>
        </div>
      )}
      <form action={saveAction} className="mt-6">
        <button className="px-4 py-2 rounded bg-blue-600 text-white">Simulate Save</button>
      </form>
    </main>
  );
}

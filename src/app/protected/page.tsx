import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function ProtectedPage() {
  const session = await getSession();
  if (!session?.user) redirect("/");

  const cookieStore = await cookies();
  const flash = cookieStore.get("flash")?.value || null;

  async function saveAction() {
    "use server";
    const session = await getSession();
    if (!session?.user) redirect("/");
    const cookieStore = await cookies();
    // Set a short-lived non-httpOnly flash message
    cookieStore.set("flash", `Saved at ${new Date().toLocaleTimeString()}`, {
      httpOnly: false,
      path: "/",
      maxAge: 15, // seconds
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    redirect("/protected");
  }

  return (
    <main className="p-8 max-w-xl mx-auto">
      <h1 className="text-2xl font-semibold">Protected</h1>
      <p className="mt-2">Hello, {session.user?.name}!</p>
      {flash && (
        <p className="mt-4 rounded bg-green-100 text-green-900 p-2">{flash}</p>
      )}
      <form action={saveAction} className="mt-6">
        <button className="px-4 py-2 rounded bg-blue-600 text-white">Simulate Save</button>
      </form>
    </main>
  );
}

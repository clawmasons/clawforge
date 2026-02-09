"use client";

import { trpc } from "@/lib/trpc";

export default function Home() {
  const hello = trpc.hello.useQuery({ name: "Clawforge" });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">Clawforge</h1>
      {hello.isLoading && <p className="text-gray-500">Connecting to API...</p>}
      {hello.error && (
        <p className="text-red-500">
          API error: {hello.error.message}
        </p>
      )}
      {hello.data && (
        <p className="text-xl text-green-600">{hello.data.greeting}</p>
      )}
      <p className="text-sm text-gray-400">
        API: {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}
      </p>
    </main>
  );
}

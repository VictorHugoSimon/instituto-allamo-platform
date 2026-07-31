"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    setIsLoading(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      router.replace("/login");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={isLoading}
      onClick={handleSignOut}
      type="button"
    >
      {isLoading ? "Saindo..." : "Sair da plataforma"}
    </button>
  );
}
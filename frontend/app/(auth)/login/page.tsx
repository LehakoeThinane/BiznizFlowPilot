"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { getCurrentUser, getStoredToken, login } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      return;
    }
    void getCurrentUser(token)
      .then(() => window.location.replace("/dashboard"))
      .catch(() => {});
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login({ email, password });
      window.location.replace("/dashboard");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Login failed";
      setError(
        message === "Invalid email or password"
          ? "We could not sign you in. Check your email and password, or create an account first."
          : message,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">BiznizFlowPilot</h1>
        <p className="mt-1 text-sm text-muted">Sign in to the operational dashboard.</p>
        <p className="mt-1 text-xs text-muted">If this is your first time, create an account first.</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-brand/20 focus:ring-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-brand/20 focus:ring-2"
            />
          </div>

          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          >
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-center text-sm text-muted">
            New business?{" "}
            <Link href="/register" className="font-medium text-brand hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </section>
    </main>
  );
}

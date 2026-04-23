"use client";

import { useEffect, useState } from "react";

import type { CurrentUser } from "@/types/api";
import { getCurrentUser, getStoredToken, logout } from "@/lib/auth";

interface AuthGuardProps {
  children: React.ReactNode;
  onUserLoaded?: (user: CurrentUser) => void;
}

export function AuthGuard({ children, onUserLoaded }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function verifySession() {
      const token = getStoredToken();
      if (!token) {
        window.location.replace("/login");
        return;
      }

      try {
        const user = await getCurrentUser(token);
        if (!isMounted) {
          return;
        }
        onUserLoaded?.(user);
        setIsLoading(false);
      } catch {
        logout();
        if (!isMounted) {
          return;
        }
        window.location.replace("/login");
      }
    }

    void verifySession();
    return () => {
      isMounted = false;
    };
  }, [onUserLoaded]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Verifying session...
      </div>
    );
  }

  return <>{children}</>;
}

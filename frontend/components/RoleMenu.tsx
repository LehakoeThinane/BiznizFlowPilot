"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { UserRole } from "@/types/api";

interface MenuItem {
  href: string;
  label: string;
  roles: UserRole[];
}

const MENU_ITEMS: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", roles: ["owner", "manager"] },
  { href: "/chat", label: "AI Assistant", roles: ["owner", "manager", "staff"] },
  { href: "/workflows", label: "Workflows", roles: ["owner", "manager"] },
  { href: "/runs", label: "Runs", roles: ["owner", "manager"] },
  { href: "/leads", label: "Leads", roles: ["owner", "manager", "staff"] },
  { href: "/tasks", label: "Tasks", roles: ["owner", "manager", "staff"] },
  { href: "/products", label: "Products", roles: ["owner", "manager", "staff"] },
  { href: "/suppliers", label: "Suppliers", roles: ["owner", "manager"] },
  { href: "/inventory", label: "Inventory", roles: ["owner", "manager", "staff"] },
  { href: "/sales-orders", label: "Sales Orders", roles: ["owner", "manager", "staff"] },
  { href: "/purchase-orders", label: "Purchase Orders", roles: ["owner", "manager"] },
];

interface RoleMenuProps {
  role: UserRole;
}

export function RoleMenu({ role }: RoleMenuProps) {
  const pathname = usePathname();
  const items = MENU_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={[
              "block rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-brand text-white"
                : "text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

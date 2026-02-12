"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { GraduationCap, Receipt, Settings, Wallet } from "lucide-react";

const FINANCE_TABS = [
  {
    label: "Fee Collection",
    href: "/dashboard/admin/finance/fee-collection",
    icon: Receipt,
  },
  {
    label: "Fee Structure",
    href: "/dashboard/admin/finance/fee-structure",
    icon: Settings,
  },
  {
    label: "Scholarships",
    href: "/dashboard/admin/finance/scholarships",
    icon: GraduationCap,
  },
  {
    label: "Payroll",
    href: "/dashboard/admin/finance/payroll",
    icon: Wallet,
  },
];

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Sub-navigation tabs */}
      <nav className="flex items-center gap-6 border-b border-dark-border">
        {FINANCE_TABS.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex items-center gap-2 px-1 py-3 text-sm font-medium border-b-2 transition-colors",
                isActive
                  ? "border-emerald-500 text-emerald-500"
                  : "border-transparent text-gray-400 hover:text-gray-200",
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

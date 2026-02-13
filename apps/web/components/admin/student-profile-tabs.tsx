"use client";

import {
  User,
  GraduationCap,
  CalendarCheck,
  Receipt,
  Folder,
  BookOpen,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileTab } from "@/types/admin";

interface StudentProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}

const TABS: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
  { id: "personal", label: "Personal", icon: <User className="mr-2 h-5 w-5" /> },
  {
    id: "academic",
    label: "Academic",
    icon: <GraduationCap className="mr-2 h-5 w-5" />,
  },
  {
    id: "attendance",
    label: "Attendance & Fees",
    icon: <CalendarCheck className="mr-2 h-5 w-5" />,
  },
  {
    id: "fees",
    label: "Fee History",
    icon: <Receipt className="mr-2 h-5 w-5" />,
  },
  {
    id: "documents",
    label: "Documents",
    icon: <Folder className="mr-2 h-5 w-5" />,
  },
  {
    id: "logbook",
    label: "Logbook",
    icon: <BookOpen className="mr-2 h-5 w-5" />,
  },
  {
    id: "campus_activity",
    label: "Campus Activity",
    icon: <QrCode className="mr-2 h-5 w-5" />,
  },
];

export function StudentProfileTabs({
  activeTab,
  onTabChange,
}: StudentProfileTabsProps) {
  return (
    <div className="overflow-x-auto border-b border-dark-border">
      <nav className="flex min-w-max space-x-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "border-emerald-500 text-emerald-500"
                : "border-transparent text-gray-500 hover:border-gray-600 hover:text-gray-300",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

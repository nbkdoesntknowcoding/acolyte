"use client";

import {
  Plus,
  Search,
  Pin,
  GraduationCap,
  Building,
  Users,
  IdCard,
  Settings,
  Home,
  SquarePen,
  Gavel,
  Shield,
  Heart,
  Brain,
  MoreVertical,
  Bold,
  Italic,
  List,
  Paperclip,
  Smartphone,
  BellRing,
  Mail,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NoticeCard, NoticeType, NoticePriority, NMCMandatoryNotice } from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/communications/notices
// ---------------------------------------------------------------------------

const TAG_ICONS: Record<string, LucideIcon> = {
  school: GraduationCap,
  domain: Building,
  groups: Users,
  badge: IdCard,
  admin: Settings,
  cottage: Home,
};

const TYPE_BADGE: Record<NoticeType, { label: string; classes: string }> = {
  circular: {
    label: "Circular",
    classes: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  notice: {
    label: "Notice",
    classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  order: {
    label: "Order",
    classes: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  },
};

const PRIORITY_BADGE: Record<
  NoticePriority,
  { label: string; classes: string; pulse?: boolean }
> = {
  urgent: {
    label: "Urgent",
    classes: "bg-red-500/10 text-red-400 border-red-500/20",
    pulse: true,
  },
  important: {
    label: "Important",
    classes: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  normal: {
    label: "Normal",
    classes: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  },
};

const NOTICES: NoticeCard[] = [
  {
    id: "n1",
    type: "circular",
    priority: "urgent",
    title: "Internal Assessment Schedule - Phase I MBBS",
    excerpt:
      "The first internal assessment for Phase I MBBS students (Batch 2023-24) is scheduled from Oct 15th to Oct 20th. Attendance is mandatory for all students.",
    tags: [
      { icon: "school", label: "Phase I Students" },
      { icon: "domain", label: "Anatomy Dept" },
    ],
    author: {
      initials: "AD",
      role: "Academic Dean",
      time: "2 hrs ago",
      avatarBg: "bg-purple-500/20",
      avatarText: "text-purple-400",
      avatarBorder: "border-purple-500/30",
    },
    readCount: 234,
    totalCount: 450,
    readBarColor: "bg-emerald-500",
    pinned: true,
  },
  {
    id: "n2",
    type: "notice",
    priority: "important",
    title: "Library Renovation Notice",
    excerpt:
      "The Central Library will remain closed for renovation from 20th Oct to 25th Oct. Digital library access will remain operational 24/7 via the portal.",
    tags: [
      { icon: "groups", label: "All Students" },
      { icon: "badge", label: "Faculty" },
    ],
    author: {
      initials: "LB",
      role: "Librarian",
      time: "Yesterday",
      avatarBg: "bg-orange-500/20",
      avatarText: "text-orange-400",
      avatarBorder: "border-orange-500/30",
    },
    readCount: 890,
    totalCount: 1200,
    readBarColor: "bg-gray-500",
  },
  {
    id: "n3",
    type: "order",
    title: "Reconstitution of Anti-Ragging Committee",
    excerpt:
      "By order of the Dean, the Anti-Ragging committee has been reconstituted for the academic year 2023-24. New members list attached.",
    tags: [{ icon: "admin", label: "All Staff" }],
    author: {
      initials: "DE",
      role: "Dean Office",
      time: "2 days ago",
      avatarBg: "bg-emerald-500/20",
      avatarText: "text-emerald-500",
      avatarBorder: "border-emerald-500/30",
    },
    readCount: 145,
    totalCount: 200,
    readBarColor: "bg-gray-500",
  },
  {
    id: "n4",
    type: "circular",
    title: "Hostel Fee Payment Deadline Extended",
    excerpt:
      "Due to technical issues with the payment gateway, the deadline for hostel fee submission has been extended to Oct 30th without late fee.",
    tags: [{ icon: "cottage", label: "Hostellers" }],
    author: {
      initials: "AC",
      role: "Accounts",
      time: "3 days ago",
      avatarBg: "bg-teal-500/20",
      avatarText: "text-teal-400",
      avatarBorder: "border-teal-500/30",
    },
    readCount: 412,
    totalCount: 500,
    readBarColor: "bg-gray-500",
  },
];

const NMC_MANDATORY: NMCMandatoryNotice[] = [
  {
    id: "nm1",
    title: "Anti-Ragging",
    lastNotice: "Last Notice: 15 days ago",
    iconBg: "bg-red-500/10",
    iconColor: "text-red-500",
    iconBorder: "border-red-500/20",
  },
  {
    id: "nm2",
    title: "ICC (Gender)",
    lastNotice: "Last Notice: 2 months ago",
    iconBg: "bg-purple-500/10",
    iconColor: "text-purple-500",
    iconBorder: "border-purple-500/20",
  },
  {
    id: "nm3",
    title: "Student Grievance",
    lastNotice: "Last Notice: 5 days ago",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
    iconBorder: "border-blue-500/20",
  },
];

const NMC_ICONS: Record<string, LucideIcon> = {
  "Anti-Ragging": Shield,
  "ICC (Gender)": Heart,
  "Student Grievance": Brain,
};

// ---------------------------------------------------------------------------

export default function NoticesPage() {
  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-dark-border bg-dark-surface px-6">
        <nav className="flex items-center text-sm font-medium text-gray-400">
          <span className="cursor-pointer hover:text-white">Communication</span>
          <span className="mx-2 text-gray-600">/</span>
          <span className="font-semibold text-white">
            Notices &amp; Circulars
          </span>
        </nav>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" /> Create Notice
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid h-full grid-cols-12 gap-6">
          {/* Left — Search + Notice Cards */}
          <div className="col-span-12 space-y-6 xl:col-span-8">
            {/* Search & Filters */}
            <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-dark-border bg-dark-surface p-4 sm:flex-row">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 h-[18px] w-[18px] text-gray-500" />
                <input
                  type="text"
                  placeholder="Search notices..."
                  className="w-full rounded-lg border border-dark-border bg-[#262626] py-2 pl-10 pr-4 text-sm text-gray-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex w-full gap-2 sm:w-auto">
                <select className="rounded-lg border border-dark-border bg-[#262626] px-3 py-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-emerald-500">
                  <option>All Types</option>
                  <option>Circular</option>
                  <option>Notice</option>
                  <option>Order</option>
                </select>
                <select className="rounded-lg border border-dark-border bg-[#262626] px-3 py-2 text-xs text-gray-300 outline-none focus:ring-1 focus:ring-emerald-500">
                  <option>Latest First</option>
                  <option>Priority</option>
                </select>
              </div>
            </div>

            {/* Notice Cards Grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {NOTICES.map((notice) => {
                const typeBadge = TYPE_BADGE[notice.type];
                const priorityBadge = notice.priority
                  ? PRIORITY_BADGE[notice.priority]
                  : null;
                const readPct = Math.round(
                  (notice.readCount / notice.totalCount) * 100,
                );

                return (
                  <div
                    key={notice.id}
                    className="group relative rounded-xl border border-dark-border bg-dark-surface p-5 transition-colors hover:border-emerald-500/50"
                  >
                    {/* Pin */}
                    <div
                      className={cn(
                        "absolute right-4 top-4 cursor-pointer transition-colors",
                        notice.pinned
                          ? "text-emerald-500"
                          : "text-gray-600 hover:text-white",
                      )}
                    >
                      <Pin className="h-[18px] w-[18px]" />
                    </div>

                    {/* Badges */}
                    <div className="mb-3 flex gap-2">
                      <span
                        className={cn(
                          "rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          typeBadge.classes,
                        )}
                      >
                        {typeBadge.label}
                      </span>
                      {priorityBadge && (
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                            priorityBadge.classes,
                          )}
                        >
                          {priorityBadge.pulse && (
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
                          )}
                          {priorityBadge.label}
                        </span>
                      )}
                    </div>

                    {/* Title & Excerpt */}
                    <h3 className="mb-2 pr-6 text-lg font-semibold leading-tight text-white">
                      {notice.title}
                    </h3>
                    <p className="mb-4 line-clamp-2 text-xs text-gray-400">
                      {notice.excerpt}
                    </p>

                    {/* Tags */}
                    <div className="mb-4 flex flex-wrap gap-2">
                      {notice.tags.map((tag) => {
                        const TagIcon = TAG_ICONS[tag.icon] ?? Users;
                        return (
                          <span
                            key={tag.label}
                            className="inline-flex items-center gap-1 rounded-md border border-dark-border bg-[#262626] px-2 py-1 text-[10px] text-gray-300"
                          >
                            <TagIcon className="h-3 w-3" />
                            {tag.label}
                          </span>
                        );
                      })}
                    </div>

                    {/* Footer — Author + Read Progress */}
                    <div className="flex items-center justify-between border-t border-dark-border pt-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold",
                            notice.author.avatarBg,
                            notice.author.avatarText,
                            notice.author.avatarBorder,
                          )}
                        >
                          {notice.author.initials}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-gray-300">
                            {notice.author.role}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {notice.author.time}
                          </span>
                        </div>
                      </div>
                      <div className="flex w-24 flex-col items-end gap-1">
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            notice.readBarColor === "bg-emerald-500"
                              ? "text-emerald-500"
                              : "text-gray-400",
                          )}
                        >
                          Read by {notice.readCount}/{notice.totalCount}
                        </span>
                        <div className="h-1 w-full rounded-full bg-[#262626]">
                          <div
                            className={cn(
                              "h-1 rounded-full",
                              notice.readBarColor,
                            )}
                            style={{ width: `${readPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Sidebar — Draft Form + NMC Mandatory */}
          <div className="col-span-12 flex flex-col gap-6 xl:col-span-4">
            {/* Draft New Notice */}
            <div className="flex flex-col rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <SquarePen className="h-5 w-5 text-emerald-500" /> Draft New
                  Notice
                </h3>
                <button className="text-xs font-medium text-emerald-500 hover:text-emerald-400">
                  Full Editor
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">
                    Title
                  </label>
                  <input
                    type="text"
                    placeholder="Enter notice title"
                    className="w-full rounded-lg border border-dark-border bg-[#262626] px-3 py-2 text-xs text-gray-200 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-400">
                      Type
                    </label>
                    <select className="w-full rounded-lg border border-dark-border bg-[#262626] px-2 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500">
                      <option>Notice</option>
                      <option>Circular</option>
                      <option>Order</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-400">
                      Priority
                    </label>
                    <select className="w-full rounded-lg border border-dark-border bg-[#262626] px-2 py-2 text-xs text-gray-200 outline-none focus:ring-1 focus:ring-emerald-500">
                      <option>Normal</option>
                      <option>Important</option>
                      <option>Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-400">
                    Content
                  </label>
                  <div className="h-32 overflow-y-auto rounded-lg border border-dark-border bg-[#262626] p-2 text-xs text-gray-300 focus-within:ring-1 focus-within:ring-emerald-500">
                    <div className="mb-2 flex gap-2 border-b border-dark-border pb-2 text-gray-500">
                      <Bold className="h-4 w-4 cursor-pointer hover:text-white" />
                      <Italic className="h-4 w-4 cursor-pointer hover:text-white" />
                      <List className="h-4 w-4 cursor-pointer hover:text-white" />
                      <Paperclip className="ml-auto h-4 w-4 cursor-pointer hover:text-white" />
                    </div>
                    <p className="opacity-50">
                      Start typing your notice content here...
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="mb-2 block text-xs font-medium text-gray-400">
                      Target Audience
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {["+ Add Batch", "+ Add Dept", "+ Add Role"].map(
                        (chip) => (
                          <span
                            key={chip}
                            className="cursor-pointer rounded border border-dark-border bg-[#262626] px-2 py-1 text-[10px] text-gray-300 transition-colors hover:border-emerald-500 hover:text-emerald-500"
                          >
                            {chip}
                          </span>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between border-t border-dark-border py-2">
                    <label className="flex cursor-pointer items-center gap-2">
                      <div className="relative h-4 w-8 rounded-full bg-gray-700">
                        <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-gray-500 transition-transform" />
                      </div>
                      <span className="text-xs text-gray-300">
                        Req. Acknowledgment
                      </span>
                    </label>
                    <div className="flex gap-2 text-gray-400">
                      <span title="In-App">
                        <Smartphone className="h-[18px] w-[18px] text-emerald-500" />
                      </span>
                      <span title="Push">
                        <BellRing className="h-[18px] w-[18px] text-emerald-500" />
                      </span>
                      <span title="Email">
                        <Mail className="h-[18px] w-[18px] cursor-pointer transition-colors hover:text-emerald-500" />
                      </span>
                    </div>
                  </div>
                </div>

                <Button className="w-full shadow-lg shadow-emerald-900/20">
                  Publish Notice
                </Button>
              </div>
            </div>

            {/* NMC Mandatory */}
            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-dark-border bg-dark-surface p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                  <Gavel className="h-5 w-5 text-gray-400" /> NMC Mandatory
                </h3>
                <span className="flex items-center gap-1 rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-500">
                  <BadgeCheck className="h-3 w-3" /> AUDIT OK
                </span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {NMC_MANDATORY.map((item) => {
                  const ItemIcon = NMC_ICONS[item.title] ?? Shield;
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-dark-border bg-[#262626]/30 p-3 transition-colors hover:bg-[#262626]/50"
                    >
                      <div className="mb-2 flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                            item.iconBg,
                            item.iconBorder,
                          )}
                        >
                          <ItemIcon
                            className={cn("h-5 w-5", item.iconColor)}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium leading-none text-gray-200">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[10px] text-gray-500">
                            {item.lastNotice}
                          </p>
                        </div>
                        <button className="text-gray-500 hover:text-white">
                          <MoreVertical className="h-5 w-5" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <button className="flex-1 rounded border border-dark-border bg-[#262626] py-1.5 text-[10px] text-gray-300 transition-colors hover:bg-dark-surface">
                          View History
                        </button>
                        <button className="flex-1 rounded border border-dark-border bg-[#262626] py-1.5 text-[10px] text-emerald-500 transition-colors hover:bg-dark-surface">
                          + Template
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

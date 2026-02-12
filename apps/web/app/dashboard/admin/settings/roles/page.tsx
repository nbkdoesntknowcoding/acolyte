"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  UserCog,
  CreditCard,
  Gavel,
  BarChart3,
  Settings,
  History,
  Save,
  Filter,
  Plus,
  Check,
} from "lucide-react";
import type {
  RoleColumnDef,
  PermissionMatrixModule,
  GranularAccessModule,
} from "@/types/admin";

// TODO: Replace with API call
const ROLES: RoleColumnDef[] = [
  {
    id: "super_admin",
    name: "Super Admin",
    subtitle: "",
    badgeLabel: "Full Access",
    badgeClasses: "text-emerald-500 bg-emerald-500/10",
    isLocked: true,
  },
  { id: "dean", name: "Dean", subtitle: "Academic Head", isLocked: false },
  { id: "hod", name: "HOD", subtitle: "Dept. Lead", isLocked: false },
  { id: "faculty", name: "Faculty", subtitle: "Teaching Staff", isLocked: false },
  { id: "warden", name: "Warden", subtitle: "Hostel Admin", isLocked: false },
  { id: "accountant", name: "Accountant", subtitle: "Finance", isLocked: false },
];

// TODO: Replace with API call
const MODULES: PermissionMatrixModule[] = [
  {
    id: "student_records",
    name: "Student Records",
    description: "Profiles, Enrollment",
    iconKey: "school",
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    permissions: { super_admin: true, dean: true, hod: true, faculty: true, warden: true, accountant: false },
  },
  {
    id: "faculty_mgmt",
    name: "Faculty Mgmt",
    description: "Staff profiles, HR",
    iconKey: "person_apron",
    iconColor: "text-purple-400",
    iconBg: "bg-purple-500/10",
    permissions: { super_admin: true, dean: true, hod: true, faculty: false, warden: false, accountant: false },
  },
  {
    id: "fees_finance",
    name: "Fees & Finance",
    description: "Invoices, Payments",
    iconKey: "payments",
    iconColor: "text-yellow-400",
    iconBg: "bg-yellow-500/10",
    permissions: { super_admin: true, dean: true, hod: false, faculty: false, warden: false, accountant: true },
  },
  {
    id: "compliance",
    name: "Compliance",
    description: "NMC rules, audits",
    iconKey: "gavel",
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10",
    permissions: { super_admin: true, dean: true, hod: true, faculty: false, warden: false, accountant: false },
  },
  {
    id: "reports_analytics",
    name: "Reports & Analytics",
    description: "All data exports",
    iconKey: "analytics",
    iconColor: "text-indigo-400",
    iconBg: "bg-indigo-500/10",
    permissions: { super_admin: true, dean: true, hod: true, faculty: true, warden: true, accountant: true },
  },
  {
    id: "system_settings",
    name: "System Settings",
    description: "Global config",
    iconKey: "settings",
    iconColor: "text-gray-400",
    iconBg: "bg-gray-500/10",
    permissions: { super_admin: true, dean: false, hod: false, faculty: false, warden: false, accountant: false },
  },
];

// TODO: Replace with API call
const GRANULAR_MODULES: GranularAccessModule[] = [
  {
    id: "students",
    name: "Students",
    iconKey: "school",
    iconColor: "text-blue-400",
    enabled: true,
    dimmed: false,
    actions: [
      { label: "View", checked: true },
      { label: "Edit", checked: true },
      { label: "Delete", checked: false },
      { label: "Export", checked: true },
    ],
  },
  {
    id: "faculty",
    name: "Faculty",
    iconKey: "person_apron",
    iconColor: "text-purple-400",
    enabled: true,
    dimmed: false,
    actions: [
      { label: "View", checked: true },
      { label: "Edit", checked: true },
      { label: "Delete", checked: false },
      { label: "Approve Leaves", checked: false },
    ],
  },
  {
    id: "fees",
    name: "Fees",
    iconKey: "payments",
    iconColor: "text-yellow-400",
    enabled: false,
    dimmed: true,
    actions: [
      { label: "View", checked: false },
      { label: "Edit", checked: false },
      { label: "Delete", checked: false },
      { label: "Collect", checked: false },
    ],
  },
  {
    id: "compliance",
    name: "Compliance",
    iconKey: "gavel",
    iconColor: "text-red-400",
    enabled: true,
    dimmed: false,
    actions: [
      { label: "View", checked: true },
      { label: "Reports", checked: true },
      { label: "Configure", checked: false },
      { label: "Submit", checked: false },
    ],
  },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  school: <GraduationCap className="w-5 h-5" />,
  person_apron: <UserCog className="w-5 h-5" />,
  payments: <CreditCard className="w-5 h-5" />,
  gavel: <Gavel className="w-5 h-5" />,
  analytics: <BarChart3 className="w-5 h-5" />,
  settings: <Settings className="w-5 h-5" />,
};

const ICON_MAP_SM: Record<string, React.ReactNode> = {
  school: <GraduationCap className="w-[18px] h-[18px]" />,
  person_apron: <UserCog className="w-[18px] h-[18px]" />,
  payments: <CreditCard className="w-[18px] h-[18px]" />,
  gavel: <Gavel className="w-[18px] h-[18px]" />,
};

/* ------------------------------------------------------------------ */
/*  Custom Checkbox                                                    */
/* ------------------------------------------------------------------ */
function PermCheckbox({
  checked,
  disabled,
  locked,
  dimmed,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  locked?: boolean;
  dimmed?: boolean;
  onChange?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled || locked}
      onClick={onChange}
      className={`
        w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-all
        ${checked
          ? "bg-emerald-500 border-emerald-500"
          : dimmed
            ? "border-[#262626] bg-[#1a1a1a]"
            : "border-[#404040] bg-transparent hover:border-gray-500"
        }
        ${(disabled || locked) ? "cursor-not-allowed" : "cursor-pointer"}
        ${dimmed && !checked ? "opacity-50" : ""}
      `}
    >
      {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle Switch                                                      */
/* ------------------------------------------------------------------ */
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`
        relative w-8 h-4 rounded-full transition-colors
        ${checked ? "bg-emerald-500" : "bg-gray-700"}
      `}
    >
      <span
        className={`
          absolute top-0 w-4 h-4 rounded-full bg-white border border-gray-300 transition-transform
          ${checked ? "translate-x-4" : "translate-x-0"}
        `}
      />
    </button>
  );
}

/* ================================================================== */
/*  Page Component                                                     */
/* ================================================================== */
export default function RolesPermissionsPage() {
  const [selectedRole] = useState("hod");

  return (
    <div className="h-[calc(100vh-64px)] overflow-hidden flex flex-col bg-[#111111]">
      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Role &amp; Permissions</h1>
            <p className="text-gray-400 text-sm mt-1">
              Configure access levels and permissions across the ERP modules.
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-[#1E1E1E] bg-[#141414] hover:bg-[#262626] text-gray-300 gap-2"
            >
              <History className="w-4 h-4" /> Audit Log
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-900/20 gap-2">
              <Save className="w-4 h-4" /> Save Permissions
            </Button>
          </div>
        </div>

        {/* ── Permission Matrix ──────────────────────────────────── */}
        <div className="bg-[#141414] border border-[#1E1E1E] rounded-xl overflow-hidden shadow-xl">
          {/* Matrix header bar */}
          <div className="border-b border-[#1E1E1E] px-6 py-4 flex items-center justify-between bg-[#262626]/30">
            <div className="flex items-center gap-4">
              <h3 className="text-base font-semibold text-white">Permission Matrix</h3>
              <span className="bg-blue-500/10 text-blue-400 text-xs px-2 py-0.5 rounded border border-blue-500/20">
                6 Roles Configured
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter
              </button>
              <div className="h-4 w-px bg-[#1E1E1E] mx-2" />
              <button className="text-xs text-emerald-500 hover:text-emerald-400 flex items-center gap-1 font-medium">
                <Plus className="w-3.5 h-3.5" /> Add New Role
              </button>
            </div>
          </div>

          {/* Matrix table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#262626] border-b border-[#1E1E1E]">
                  <th className="sticky left-0 z-20 bg-[#262626] px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider min-w-[200px] border-r border-[#1E1E1E]">
                    Module Access
                  </th>
                  {ROLES.map((role) => (
                    <th key={role.id} className="px-4 py-3 text-center min-w-[120px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-white">{role.name}</span>
                        {role.badgeLabel ? (
                          <span className={`text-[10px] px-1.5 rounded ${role.badgeClasses}`}>
                            {role.badgeLabel}
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500">{role.subtitle}</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E1E1E] text-sm">
                {MODULES.map((mod) => (
                  <tr
                    key={mod.id}
                    className="hover:bg-[#262626]/30 transition-colors group"
                  >
                    <td className="sticky left-0 z-10 bg-[#141414] group-hover:bg-[#262626]/30 px-6 py-4 border-r border-[#1E1E1E]">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded ${mod.iconBg} ${mod.iconColor}`}>
                          {ICON_MAP[mod.iconKey]}
                        </div>
                        <div>
                          <p className="font-medium text-white">{mod.name}</p>
                          <p className="text-xs text-gray-500">{mod.description}</p>
                        </div>
                      </div>
                    </td>
                    {ROLES.map((role) => {
                      const isChecked = mod.permissions[role.id] ?? false;
                      const isSuperAdmin = role.isLocked;
                      return (
                        <td
                          key={role.id}
                          className={`text-center p-4 ${isSuperAdmin ? "bg-emerald-500/5" : ""}`}
                        >
                          <div className="flex justify-center">
                            <PermCheckbox
                              checked={isChecked}
                              locked={isSuperAdmin}
                              dimmed={!isChecked && !isSuperAdmin}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Bottom Section: Role Details + Granular Access ────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Role Details */}
          <div className="xl:col-span-1 bg-[#141414] border border-[#1E1E1E] rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-4">Role Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Role Name
                </label>
                <input
                  type="text"
                  defaultValue="HOD"
                  className="w-full bg-[#262626] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Description
                </label>
                <textarea
                  defaultValue="Head of Department with access to departmental student data, faculty management, and internal reporting."
                  className="w-full bg-[#262626] border border-[#1E1E1E] rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all h-24 resize-none"
                />
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <PermCheckbox checked={true} />
                  <span className="text-sm text-gray-300">Active Role</span>
                </label>
              </div>
            </div>
          </div>

          {/* Granular Access Control */}
          <div className="xl:col-span-2 bg-[#141414] border border-[#1E1E1E] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white">
                Granular Access Control:{" "}
                <span className="text-emerald-500">
                  {ROLES.find((r) => r.id === selectedRole)?.name}
                </span>
              </h3>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Enabled
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-gray-600" /> Disabled
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GRANULAR_MODULES.map((mod) => (
                <div
                  key={mod.id}
                  className={`bg-[#262626]/30 border border-[#1E1E1E] rounded-lg p-4 ${mod.dimmed ? "opacity-75" : ""}`}
                >
                  {/* Module header with toggle */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1E1E1E]">
                    <div className="flex items-center gap-2">
                      <span className={mod.iconColor}>
                        {ICON_MAP_SM[mod.iconKey]}
                      </span>
                      <span className="text-sm font-medium text-white">{mod.name}</span>
                    </div>
                    <ToggleSwitch checked={mod.enabled} />
                  </div>

                  {/* Action permissions */}
                  <div
                    className={`grid grid-cols-2 gap-2 text-sm ${mod.dimmed ? "text-gray-500" : ""}`}
                  >
                    {mod.actions.map((action) => (
                      <label
                        key={action.label}
                        className={`flex items-center gap-2 select-none ${
                          mod.dimmed
                            ? "cursor-not-allowed"
                            : "text-gray-300 hover:text-white cursor-pointer"
                        }`}
                      >
                        <PermCheckbox
                          checked={action.checked}
                          disabled={mod.dimmed}
                          dimmed={mod.dimmed}
                        />
                        {action.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import {
  BookOpen,
  TrendingUp,
  BarChart3,
  Quote,
  History,
  Search,
  RefreshCw,
  Filter,
  ExternalLink,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { FacultyPublication, ResearchCoAuthor } from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/faculty/{id}/publications
// ---------------------------------------------------------------------------

const STAT_CARDS = [
  {
    label: "Total Publications",
    value: "12",
    trend: "+2 this year",
    trendPositive: true,
    iconColor: "text-emerald-500",
    bgIcon: BookOpen,
  },
  {
    label: "H-Index",
    value: "8",
    subtext: "Scopus / Web of Science",
    iconColor: "text-blue-500",
    bgIcon: BarChart3,
  },
  {
    label: "Total Citations",
    value: "156",
    trend: "+14 this month",
    trendPositive: true,
    iconColor: "text-yellow-500",
    bgIcon: Quote,
  },
  {
    label: "Last 5 Years (NAAC)",
    value: "9",
    subtext: "Meets Criteria",
    subtextColor: "text-purple-400",
    iconColor: "text-purple-500",
    bgIcon: History,
  },
];

const PUBLICATIONS: FacultyPublication[] = [
  {
    id: "1",
    title:
      "Morphometric analysis of the nutrient foramen of the humerus in North Indian population",
    articleType: "Original Article",
    articleTypeColor: "blue",
    doi: "10.1016/j.jasi.2023.01.004",
    journal: "Journal of Anatomical Society of India",
    volume: "Vol 72, Issue 1 • Mar 2023",
    indexing: [
      { label: "Scopus", color: "orange" },
      { label: "PubMed", color: "blue" },
    ],
    impactFactor: "0.45",
    citations: 4,
  },
  {
    id: "2",
    title:
      "Anatomical variations of the Circle of Willis: A cadaveric study with clinical implications",
    articleType: "Original Article",
    articleTypeColor: "blue",
    doi: "10.7759/cureus.14562",
    journal: "Cureus Journal of Medical Science",
    volume: "Vol 15, Issue 4 • Apr 2022",
    indexing: [
      { label: "PubMed Central", color: "blue" },
      { label: "WoS", color: "purple" },
    ],
    impactFactor: "1.2",
    citations: 12,
  },
  {
    id: "3",
    title:
      "Case report: Unilateral absence of the musculocutaneous nerve and its clinical significance",
    articleType: "Case Report",
    articleTypeColor: "green",
    journal: "International Journal of Anatomy and Research",
    volume: "Vol 9, Issue 2 • Feb 2021",
    indexing: [{ label: "Index Copernicus", color: "gray" }],
    impactFactor: "-",
    citations: 2,
  },
  {
    id: "4",
    title:
      "Histological changes in kidney tissue following exposure to heavy metals: A review",
    articleType: "Review Article",
    articleTypeColor: "purple",
    doi: "10.1002/ar.24512",
    journal: "The Anatomical Record",
    volume: "Vol 304, Issue 11 • Nov 2020",
    indexing: [
      { label: "Scopus", color: "orange" },
      { label: "WoS", color: "purple" },
    ],
    impactFactor: "2.1",
    citations: 45,
  },
  {
    id: "5",
    title:
      "Effectiveness of 3D printed models in anatomy education for undergraduate medical students",
    articleType: "Original Article",
    articleTypeColor: "blue",
    doi: "10.1186/s12909-019-1782-2",
    journal: "BMC Medical Education",
    volume: "Vol 19, Issue 1 • Aug 2019",
    indexing: [
      { label: "Scopus", color: "orange" },
      { label: "PubMed", color: "blue" },
    ],
    impactFactor: "3.6",
    citations: 89,
  },
];

const CO_AUTHORS: ResearchCoAuthor[] = [
  { name: "Dr. Ravi Bansal", initials: "RB", department: "Dept. of Surgery" },
  {
    name: "Dr. Neha Kapoor",
    initials: "NK",
    department: "Dept. of Physiology",
  },
];

const RESEARCH_INTERESTS = [
  "Clinical Anatomy",
  "Morphometry",
  "Medical Education",
  "Histology",
];

const INDEXING_COLORS: Record<string, string> = {
  orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  blue: "bg-blue-600/10 text-blue-400 border-blue-600/20",
  purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  gray: "bg-gray-600/10 text-gray-400 border-gray-600/20",
  green: "bg-green-500/10 text-green-400 border-green-500/20",
};

export function PublicationsTab() {
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map((stat) => {
          const Icon = stat.bgIcon;
          return (
            <Card key={stat.label} className="relative overflow-hidden group">
              <CardContent className="p-4">
                <div className="absolute right-0 top-0 p-3 opacity-10 transition-opacity group-hover:opacity-20">
                  <Icon className={cn("h-10 w-10", stat.iconColor)} />
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {stat.label}
                </p>
                <h3 className="mt-1 text-3xl font-bold text-white">
                  {stat.value}
                </h3>
                {stat.trend && (
                  <p
                    className={cn(
                      "mt-2 flex items-center gap-1 text-[10px]",
                      stat.trendPositive
                        ? "text-emerald-400"
                        : "text-red-400",
                    )}
                  >
                    <TrendingUp className="h-2.5 w-2.5" /> {stat.trend}
                  </p>
                )}
                {stat.subtext && (
                  <p
                    className={cn(
                      "mt-2 text-[10px]",
                      stat.subtextColor ?? "text-gray-500",
                    )}
                  >
                    {stat.subtext}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Publications Table + Sidebar */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        {/* Publications Table — 3/4 */}
        <div className="space-y-4 xl:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-white">
              <BookOpen className="h-5 w-5 text-emerald-500" />
              Published Works
            </h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search publications..."
                  className="h-8 w-48 pl-8 text-xs"
                />
              </div>
              <Button size="sm" className="text-xs">
                <RefreshCw className="mr-2 h-3.5 w-3.5" /> Sync from ORCID
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                  <TableHead className="w-[40%] font-semibold">
                    Publication Title
                  </TableHead>
                  <TableHead className="font-semibold">
                    Journal &amp; Date
                  </TableHead>
                  <TableHead className="font-semibold">Indexing</TableHead>
                  <TableHead className="text-center font-semibold">
                    Impact Factor
                  </TableHead>
                  <TableHead className="text-center font-semibold">
                    Citations
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {PUBLICATIONS.map((pub) => (
                  <TableRow
                    key={pub.id}
                    className="group transition-colors hover:bg-[#262626]/20"
                  >
                    <TableCell className="py-4">
                      <p className="line-clamp-2 text-sm font-medium leading-relaxed text-white">
                        {pub.title}
                      </p>
                      <div className="mt-1 flex gap-2">
                        <span
                          className={cn(
                            "rounded border px-1.5 py-0.5 text-[10px]",
                            INDEXING_COLORS[pub.articleTypeColor],
                          )}
                        >
                          {pub.articleType}
                        </span>
                        {pub.doi && (
                          <span className="text-[10px] text-gray-500">
                            DOI: {pub.doi}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <p className="font-medium text-gray-300">
                        {pub.journal}
                      </p>
                      <p className="text-[11px] text-gray-500">{pub.volume}</p>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-wrap gap-1.5">
                        {pub.indexing.map((idx) => (
                          <span
                            key={idx.label}
                            className={cn(
                              "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-medium",
                              INDEXING_COLORS[idx.color],
                            )}
                          >
                            {idx.label}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <span className="font-mono font-bold text-gray-300">
                        {pub.impactFactor}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <span className="font-mono text-gray-400">
                        {pub.citations}
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <button className="text-gray-500 transition-colors hover:text-white">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-dark-border bg-[#262626]/30 p-3 text-xs text-gray-400">
              <div>Showing 1-5 of 12 publications</div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded p-1 hover:bg-[#262626] disabled:opacity-50"
                  disabled
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className="rounded bg-emerald-500 px-2 py-0.5 text-white">
                  1
                </button>
                <button className="rounded px-2 py-0.5 hover:bg-[#262626]">
                  2
                </button>
                <button className="rounded px-2 py-0.5 hover:bg-[#262626]">
                  3
                </button>
                <button className="rounded p-1 hover:bg-[#262626]">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </Card>
        </div>

        {/* Research Impact Sidebar — 1/4 */}
        <div className="xl:col-span-1">
          <Card className="sticky top-6">
            <CardContent className="p-5">
              <div className="mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-500" />
                <h3 className="text-base font-bold text-white">
                  Research Impact
                </h3>
              </div>
              <div className="space-y-6">
                {/* ORCID ID */}
                <div className="flex items-start gap-3 rounded-lg border border-dark-border bg-[#262626]/30 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A6CE39]/20">
                    <span className="text-[10px] font-bold text-[#A6CE39]">
                      ID
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">ORCID iD</p>
                    <p className="truncate font-mono text-sm text-white">
                      0000-0002-1825-0097
                    </p>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-green-500">
                      <CheckCircle className="h-2.5 w-2.5" /> Verified
                    </div>
                  </div>
                </div>

                {/* Research Interests */}
                <div>
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Research Interests
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {RESEARCH_INTERESTS.map((interest) => (
                      <span
                        key={interest}
                        className="rounded border border-dark-border bg-[#262626] px-2 py-1 text-[11px] text-gray-300"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Top Co-authors */}
                <div className="border-t border-dark-border pt-4">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Top Co-authors
                  </h4>
                  <ul className="space-y-3">
                    {CO_AUTHORS.map((author) => (
                      <li
                        key={author.name}
                        className="group flex cursor-pointer items-center gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-300">
                          {author.initials}
                        </div>
                        <div>
                          <p className="text-sm text-gray-200 transition-colors group-hover:text-emerald-500">
                            {author.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {author.department}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sync Info */}
                <div className="rounded-lg border border-blue-900/30 bg-blue-900/10 p-3">
                  <div className="flex gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <p className="text-[10px] text-blue-200/70">
                      Publications are automatically synced every Monday at
                      02:00 AM. Last sync: Today 02:00 AM.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

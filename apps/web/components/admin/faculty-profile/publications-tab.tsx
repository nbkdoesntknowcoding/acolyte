"use client";

import {
  BookOpen,
  BarChart3,
  Quote,
  History,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFacultyPortfolio } from "@/lib/hooks/admin/use-faculty";
import type { FacultyResponse } from "@/types/admin-api";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PublicationsTabProps {
  faculty: FacultyResponse;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PublicationsTab({ faculty }: PublicationsTabProps) {
  const { data: portfolio, isLoading, error } = useFacultyPortfolio(faculty.id);

  const publications = portfolio?.publications ?? [];

  const statCards = [
    {
      label: "Total Publications",
      value: String(faculty.publications_count ?? 0),
      iconColor: "text-emerald-500",
      bgIcon: BookOpen,
    },
    {
      label: "H-Index",
      value: String(faculty.h_index ?? 0),
      subtext: "Scopus / Web of Science",
      iconColor: "text-blue-500",
      bgIcon: BarChart3,
    },
    {
      label: "Total Citations",
      value: "—",
      subtext: "From portfolio",
      iconColor: "text-yellow-500",
      bgIcon: Quote,
    },
    {
      label: "Last 5 Years (NAAC)",
      value: "—",
      subtext: "From portfolio",
      iconColor: "text-purple-500",
      bgIcon: History,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
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
                {stat.subtext && (
                  <p className="mt-2 text-[10px] text-gray-500">
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
          </div>

          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : error || publications.length === 0 ? (
              <div className="p-8 text-center">
                <BookOpen className="mx-auto h-8 w-8 text-gray-600" />
                <p className="mt-2 text-sm text-gray-500">
                  {error
                    ? "Publications will be available once the portfolio endpoint is configured."
                    : "No publications recorded."}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#262626]/50 text-[11px] uppercase tracking-wider text-gray-500">
                    <TableHead className="w-[40%] font-semibold">
                      Publication Title
                    </TableHead>
                    <TableHead className="font-semibold">Journal</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
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
                  {publications.map((pub, i) => (
                    <TableRow
                      key={`pub-${i}`}
                      className="group transition-colors hover:bg-[#262626]/20"
                    >
                      <TableCell className="py-4">
                        <p className="line-clamp-2 text-sm font-medium leading-relaxed text-white">
                          {pub.title}
                        </p>
                        {pub.doi && (
                          <p className="mt-1 text-[10px] text-gray-500">
                            DOI: {pub.doi}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        <p className="text-sm text-gray-300">
                          {pub.journal ?? "—"}
                        </p>
                        {pub.year && (
                          <p className="text-[11px] text-gray-500">
                            {pub.year}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-4">
                        {pub.article_type && (
                          <span className="rounded border border-blue-600/20 bg-blue-600/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                            {pub.article_type}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <span className="font-mono font-bold text-gray-300">
                          {pub.impact_factor ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        <span className="font-mono text-gray-400">
                          {pub.citations ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-4 text-center">
                        {pub.doi && (
                          <a
                            href={`https://doi.org/${pub.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-500 transition-colors hover:text-white"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
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
                {faculty.orcid_id ? (
                  <div className="flex items-start gap-3 rounded-lg border border-dark-border bg-[#262626]/30 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#A6CE39]/20">
                      <span className="text-[10px] font-bold text-[#A6CE39]">
                        ID
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">ORCID iD</p>
                      <p className="truncate font-mono text-sm text-white">
                        {faculty.orcid_id}
                      </p>
                      <div className="mt-1 flex items-center gap-1 text-[10px] text-green-500">
                        <CheckCircle className="h-2.5 w-2.5" /> Linked
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dark-border bg-[#262626]/30 p-3 text-center">
                    <p className="text-xs text-gray-500">
                      No ORCID iD linked
                    </p>
                  </div>
                )}

                {/* Sync from ORCID */}
                {faculty.orcid_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Sync from ORCID
                    (TODO)
                  </Button>
                )}

                {/* Info */}
                <div className="rounded-lg border border-blue-900/30 bg-blue-900/10 p-3">
                  <div className="flex gap-2">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
                    <p className="text-[10px] text-blue-200/70">
                      Publications will sync automatically once the ORCID
                      integration is configured.
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

'use client';

import { useState, useMemo } from 'react';
import {
  Users,
  GraduationCap,
  Briefcase,
  ClipboardCheck,
  Mail,
  Phone,
  Search,
  Filter,
  Plus,
  AlertCircle,
  Loader2,
  X,
  Edit,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAlumni,
  useCreateAlumni,
  useUpdateAlumni,
} from '@/lib/hooks/admin/use-alumni';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GraduateOutcome {
  label: string;
  percentage: number;
  color: string;
}

interface PGTrend {
  year: string;
  percentage: number;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AlumniManagementPage() {
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [graduationYearFilter, setGraduationYearFilter] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAlumni, setEditingAlumni] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    graduation_year: '',
    batch: '',
    email: '',
    phone: '',
    current_position: '',
    current_organization: '',
    current_location_city: '',
    current_location_state: '',
    current_location_country: 'India',
    pg_qualification: '',
    pg_specialization: '',
    employment_type: '',
  });

  // API calls
  const {
    data: alumniData,
    isLoading: alumniLoading,
    error: alumniError,
  } = useAlumni({
    search: searchQuery || undefined,
    graduation_year: graduationYearFilter
      ? parseInt(graduationYearFilter)
      : undefined,
    employment_type: employmentTypeFilter || undefined,
    page_size: 100,
  });

  const createMutation = useCreateAlumni();
  const updateMutation = useUpdateAlumni();

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const alumni = useMemo(() => alumniData?.data || [], [alumniData?.data]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = alumni.length;
    const withPG = alumni.filter((a) => a.pg_qualification).length;
    const employed = alumni.filter((a) => a.employment_type).length;

    return {
      total,
      pgPercentage: total > 0 ? Math.round((withPG / total) * 100) : 0,
      employmentRate: total > 0 ? Math.round((employed / total) * 100) : 0,
    };
  }, [alumni]);

  // Graduate outcomes aggregation
  const graduateOutcomes: GraduateOutcome[] = useMemo(() => {
    const total = alumni.length;
    if (total === 0) return [];

    // Count by employment type
    const employmentCounts: Record<string, number> = {};
    const pgIndia = alumni.filter(
      (a) =>
        a.pg_qualification &&
        (a.current_location_country === 'India' || !a.current_location_country),
    ).length;
    const pgAbroad = alumni.filter(
      (a) => a.pg_qualification && a.current_location_country !== 'India',
    ).length;

    alumni.forEach((a) => {
      if (a.employment_type) {
        employmentCounts[a.employment_type] =
          (employmentCounts[a.employment_type] || 0) + 1;
      }
    });

    const outcomes: GraduateOutcome[] = [];

    if (pgIndia > 0) {
      outcomes.push({
        label: 'PG India',
        percentage: Math.round((pgIndia / total) * 100),
        color: '#10b981',
      });
    }
    if (pgAbroad > 0) {
      outcomes.push({
        label: 'PG Abroad',
        percentage: Math.round((pgAbroad / total) * 100),
        color: '#ec4899',
      });
    }

    Object.entries(employmentCounts).forEach(([type, count]) => {
      const percentage = Math.round((count / total) * 100);
      if (percentage > 0) {
        outcomes.push({
          label: type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
          percentage,
          color: getColorForEmploymentType(type),
        });
      }
    });

    return outcomes;
  }, [alumni]);

  // PG trends by year
  const pgTrends: PGTrend[] = useMemo(() => {
    const yearGroups: Record<string, { total: number; withPG: number }> = {};

    alumni.forEach((a) => {
      if (a.graduation_year) {
        const year = a.graduation_year.toString();
        if (!yearGroups[year]) {
          yearGroups[year] = { total: 0, withPG: 0 };
        }
        yearGroups[year].total++;
        if (a.pg_qualification) {
          yearGroups[year].withPG++;
        }
      }
    });

    return Object.entries(yearGroups)
      .map(([year, data]) => ({
        year,
        percentage:
          data.total > 0 ? Math.round((data.withPG / data.total) * 100) : 0,
      }))
      .sort((a, b) => parseInt(a.year) - parseInt(b.year))
      .slice(-5); // Last 5 years
  }, [alumni]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAddClick = () => {
    setFormData({
      name: '',
      graduation_year: '',
      batch: '',
      email: '',
      phone: '',
      current_position: '',
      current_organization: '',
      current_location_city: '',
      current_location_state: '',
      current_location_country: 'India',
      pg_qualification: '',
      pg_specialization: '',
      employment_type: '',
    });
    setShowAddModal(true);
  };

  const handleEditClick = (alumniId: string) => {
    const alumnus = alumni.find((a) => a.id === alumniId);
    if (!alumnus) return;

    setFormData({
      name: alumnus.name,
      graduation_year: alumnus.graduation_year?.toString() || '',
      batch: alumnus.batch || '',
      email: alumnus.email || '',
      phone: alumnus.phone || '',
      current_position: alumnus.current_position || '',
      current_organization: alumnus.current_organization || '',
      current_location_city: alumnus.current_location_city || '',
      current_location_state: alumnus.current_location_state || '',
      current_location_country: alumnus.current_location_country || 'India',
      pg_qualification: alumnus.pg_qualification || '',
      pg_specialization: alumnus.pg_specialization || '',
      employment_type: alumnus.employment_type || '',
    });
    setEditingAlumni(alumniId);
  };

  const handleSubmit = async () => {
    try {
      if (editingAlumni) {
        await updateMutation.mutateAsync({
          id: editingAlumni,
          data: {
            name: formData.name,
            email: formData.email || null,
            phone: formData.phone || null,
            current_position: formData.current_position || null,
            current_organization: formData.current_organization || null,
            employment_type: formData.employment_type || null,
          },
        });
        setEditingAlumni(null);
      } else {
        await createMutation.mutateAsync({
          name: formData.name,
          graduation_year: formData.graduation_year
            ? parseInt(formData.graduation_year)
            : null,
          batch: formData.batch || null,
          email: formData.email || null,
          phone: formData.phone || null,
          current_position: formData.current_position || null,
          current_organization: formData.current_organization || null,
          current_location_city: formData.current_location_city || null,
          current_location_state: formData.current_location_state || null,
          current_location_country:
            formData.current_location_country || 'India',
          pg_qualification: formData.pg_qualification || null,
          pg_specialization: formData.pg_specialization || null,
          employment_type: formData.employment_type || null,
        });
        setShowAddModal(false);
      }
    } catch (error) {
      console.error('Failed to save alumni:', error);
      alert('Failed to save alumni. Please try again.');
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingAlumni(null);
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  function getColorForEmploymentType(type: string): string {
    const colors: Record<string, string> = {
      government_service: '#3b82f6',
      private_practice: '#f59e0b',
      hospital_employed: '#8b5cf6',
      academic: '#06b6d4',
      research: '#ec4899',
      abroad: '#14b8a6',
      other: '#64748b',
    };
    return colors[type] || '#64748b';
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (alumniError) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-sm text-gray-400">
            Failed to load alumni data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Alumni Dashboard</h1>
          <Badge className="rounded-full border-emerald-500/20">
            Active Network
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleAddClick}>
            <Plus className="h-4 w-4" /> Add Alumni
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Total Alumni
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  {alumniLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    stats.total.toLocaleString()
                  )}
                </h3>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Users className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  PG Admissions
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  {alumniLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    `${stats.pgPercentage}%`
                  )}
                </h3>
              </div>
              <div className="rounded-lg bg-blue-500/10 p-2">
                <GraduationCap className="h-5 w-5 text-blue-500" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Admitted to higher studies</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Employment Rate
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  {alumniLoading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    `${stats.employmentRate}%`
                  )}
                </h3>
              </div>
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <Briefcase className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  NAAC Crit 5 Score
                </p>
                <h3 className="mt-1 text-2xl font-bold text-white">
                  3.2
                  <span className="text-base font-normal text-gray-400">
                    /4
                  </span>
                </h3>
              </div>
              <div className="rounded-lg bg-purple-500/10 p-2">
                <ClipboardCheck className="h-5 w-5 text-purple-500" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Criterion 5: Student Support</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Graduate Outcomes Donut */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Graduate Outcomes</CardTitle>
          </CardHeader>
          <CardContent>
            {alumniLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : graduateOutcomes.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                No data available
              </div>
            ) : (
              <div className="flex flex-col items-center gap-8 sm:flex-row">
                <div className="h-48 w-48 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={graduateOutcomes}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        dataKey="percentage"
                        strokeWidth={0}
                      >
                        {graduateOutcomes.map((entry) => (
                          <Cell key={entry.label} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                  {graduateOutcomes.map((outcome) => (
                    <div key={outcome.label} className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: outcome.color }}
                      />
                      <span className="text-gray-300">
                        {outcome.label} ({outcome.percentage}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PG Admission Trends Bar Chart */}
        <Card className="flex flex-col">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">
              PG Admission Trends (5 Years)
            </CardTitle>
            <span className="rounded bg-[#262626] px-2 py-1 text-xs text-gray-500">
              Last 5 Years
            </span>
          </CardHeader>
          <CardContent className="flex-1">
            {alumniLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : pgTrends.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-sm text-gray-400">
                No data available
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={pgTrends}
                    margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="year"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#6b7280', fontSize: 12 }}
                      domain={[0, 100]}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        return (
                          <div className="rounded border border-[#1E1E1E] bg-[#141414] px-3 py-1.5 text-xs font-bold text-emerald-500 shadow-lg">
                            {payload[0].value}%
                          </div>
                        );
                      }}
                      cursor={{ fill: 'rgba(16,185,127,0.05)' }}
                    />
                    <Bar
                      dataKey="percentage"
                      fill="#10b981"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Alumni Directory */}
      <Card>
        <CardContent className="p-4">
          {/* Filters */}
          <div className="mb-4 flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex w-full flex-1 items-center gap-3 overflow-x-auto pb-2 md:pb-0">
              <div className="relative w-full shrink-0 md:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search directory..."
                  className="border-[#1E1E1E] bg-[#141414] pl-9 text-white placeholder:text-gray-500"
                />
              </div>
              <div className="mx-2 hidden h-8 w-px bg-[#1E1E1E] md:block" />
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={graduationYearFilter}
                  onChange={(e) => setGraduationYearFilter(e.target.value)}
                  placeholder="Year"
                  className="h-8 w-24 border-[#1E1E1E] bg-[#141414] text-sm text-white"
                />
                <select
                  value={employmentTypeFilter}
                  onChange={(e) => setEmploymentTypeFilter(e.target.value)}
                  className="h-8 rounded-lg border border-[#1E1E1E] bg-[#141414] px-3 text-sm text-white outline-none"
                >
                  <option value="">All Employment</option>
                  <option value="government_service">Government Service</option>
                  <option value="private_practice">Private Practice</option>
                  <option value="hospital_employed">Hospital Employed</option>
                  <option value="academic">Academic</option>
                  <option value="research">Research</option>
                  <option value="abroad">Abroad</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setSearchQuery('');
                setGraduationYearFilter('');
                setEmploymentTypeFilter('');
              }}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg border border-[#1E1E1E]">
            {alumniLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : alumni.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">
                No alumni found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#1E1E1E] bg-[#262626]/50 hover:bg-[#262626]/50">
                    <TableHead className="min-w-[200px] px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Alumni Name
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Batch
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Current Position
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Organization
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Location
                    </TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      PG Qualification
                    </TableHead>
                    <TableHead className="px-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Contact
                    </TableHead>
                    <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alumni.map((alumnus) => (
                    <TableRow
                      key={alumnus.id}
                      className="border-[#1E1E1E] hover:bg-[#262626]/30"
                    >
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#262626] text-sm font-bold text-gray-400">
                            {getInitials(alumnus.name)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {alumnus.name}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-300">
                        {alumnus.batch || alumnus.graduation_year || '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-300">
                        {alumnus.current_position || '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-300">
                        {alumnus.current_organization || '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-400">
                        {alumnus.current_location_city || '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        {alumnus.pg_qualification ? (
                          <span className="inline-flex items-center rounded-full bg-blue-900/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-300">
                            {alumnus.pg_qualification}
                          </span>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {alumnus.email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-emerald-500"
                            onClick={() =>
                              (window.location.href = `mailto:${alumnus.email}`)
                            }
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {alumnus.phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-emerald-500"
                            onClick={() =>
                              (window.location.href = `tel:${alumnus.phone}`)
                            }
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:bg-[#262626] hover:text-emerald-500"
                          onClick={() => handleEditClick(alumnus.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!alumniLoading && alumniData && (
            <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
              <span>
                Showing 1-{alumniData.data.length} of {alumniData.total}{' '}
                entries
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={alumniData.page === 1}
                  className="text-xs"
                >
                  Previous
                </Button>
                <Button size="sm" className="px-3 text-xs">
                  {alumniData.page}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={alumniData.page >= alumniData.total_pages}
                  className="text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Alumni Modal */}
      {(showAddModal || editingAlumni) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[#1E1E1E] bg-[#141414] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                {editingAlumni ? 'Edit Alumni' : 'Add Alumni'}
              </h2>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">
                    Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Graduation Year</Label>
                  <Input
                    type="number"
                    value={formData.graduation_year}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        graduation_year: e.target.value,
                      })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Batch</Label>
                  <Input
                    value={formData.batch}
                    onChange={(e) =>
                      setFormData({ ...formData, batch: e.target.value })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">Phone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Current Position</Label>
                  <Input
                    value={formData.current_position}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_position: e.target.value,
                      })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Organization</Label>
                <Input
                  value={formData.current_organization}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      current_organization: e.target.value,
                    })
                  }
                  className="border-[#1E1E1E] bg-[#262626] text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-gray-300">City</Label>
                  <Input
                    value={formData.current_location_city}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_location_city: e.target.value,
                      })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">State</Label>
                  <Input
                    value={formData.current_location_state}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_location_state: e.target.value,
                      })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">Country</Label>
                  <Input
                    value={formData.current_location_country}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        current_location_country: e.target.value,
                      })
                    }
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300">PG Qualification</Label>
                  <Input
                    value={formData.pg_qualification}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pg_qualification: e.target.value,
                      })
                    }
                    placeholder="e.g., MD, MS, DNB"
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">PG Specialization</Label>
                  <Input
                    value={formData.pg_specialization}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        pg_specialization: e.target.value,
                      })
                    }
                    placeholder="e.g., Medicine, Surgery"
                    className="border-[#1E1E1E] bg-[#262626] text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300">Employment Type</Label>
                <select
                  value={formData.employment_type}
                  onChange={(e) =>
                    setFormData({ ...formData, employment_type: e.target.value })
                  }
                  className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] p-2 text-white outline-none"
                >
                  <option value="">Select Employment Type</option>
                  <option value="government_service">Government Service</option>
                  <option value="private_practice">Private Practice</option>
                  <option value="hospital_employed">Hospital Employed</option>
                  <option value="academic">Academic</option>
                  <option value="research">Research</option>
                  <option value="abroad">Abroad</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={closeModal}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 rounded border border-[#1E1E1E] bg-[#262626] py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formData.name
                }
                className="flex flex-1 items-center justify-center gap-2 rounded bg-emerald-500 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingAlumni ? 'Update' : 'Add'} Alumni
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

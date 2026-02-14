'use client';

import { useState, useMemo } from 'react';
import { Loader2, AlertCircle, Save, Building2, Settings as SettingsIcon, Shield, Bell, Plug, FileText, ChevronDown, ChevronRight } from 'lucide-react';
import { useCollegeProfile, useUpdateCollegeProfile, useAuditLog } from '@/lib/hooks/admin/use-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CollegeProfileUpdate, AuditLogResponse } from '@/types/admin-api';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-gray-400 mt-2">
          Configure college profile, academic parameters, and system settings
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-[#1E1E1E] border border-[#262626]">
          <TabsTrigger value="profile" className="gap-2">
            <Building2 className="h-4 w-4" />
            College Profile
          </TabsTrigger>
          <TabsTrigger value="academic" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            Academic Config
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2">
            <FileText className="h-4 w-4" />
            Audit Log
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Roles & Permissions
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="integrations" className="gap-2">
            <Plug className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <CollegeProfileSection />
        </TabsContent>

        <TabsContent value="academic" className="mt-6">
          <AcademicConfigSection />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <AuditLogSection />
        </TabsContent>

        <TabsContent value="roles" className="mt-6">
          <TodoPlaceholder
            title="Role & Permissions Management"
            description="This section will integrate with Permify to manage role-based access control across the platform."
            features={[
              'Define custom roles per department',
              'Assign permissions using Zanzibar ReBAC model',
              'View role hierarchy and inheritance',
              'Bulk role assignments',
            ]}
          />
        </TabsContent>

        <TabsContent value="notifications" className="mt-6">
          <TodoPlaceholder
            title="Notification Settings"
            description="Configure notification preferences for various system events."
            features={[
              'Email notification templates',
              'SMS gateway configuration',
              'Push notification settings',
              'Event subscription management',
            ]}
          />
        </TabsContent>

        <TabsContent value="integrations" className="mt-6">
          <TodoPlaceholder
            title="Integration Settings"
            description="Manage third-party integrations and API configurations."
            features={[
              'Razorpay payment gateway credentials',
              'AEBAS integration configuration',
              'University portal adapters',
              'HMIS data bridge settings',
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// College Profile Section
// ---------------------------------------------------------------------------

function CollegeProfileSection() {
  const { data: profile, isLoading, error } = useCollegeProfile();
  const updateMutation = useUpdateCollegeProfile();

  const [formData, setFormData] = useState<CollegeProfileUpdate>({});
  const [isEditing, setIsEditing] = useState(false);

  // Sync form data when profile loads
  useMemo(() => {
    if (profile && !isEditing) {
      setFormData({
        name: profile.name,
        phone: profile.phone ?? undefined,
        email: profile.email ?? undefined,
        website: profile.website ?? undefined,
        address: profile.address ?? undefined,
        city: profile.city ?? undefined,
        district: profile.district ?? undefined,
        logo_url: profile.logo_url ?? undefined,
      });
    }
  }, [profile, isEditing]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(formData);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-[#141414] border-[#262626]">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#141414] border-[#262626]">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-400">Failed to load college profile</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#141414] border-[#262626]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white">College Profile</CardTitle>
          <CardDescription className="text-gray-400">
            Basic information about your institution
          </CardDescription>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
            Edit Profile
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setIsEditing(false);
                // Reset form data
                if (profile) {
                  setFormData({
                    name: profile.name,
                    phone: profile.phone ?? undefined,
                    email: profile.email ?? undefined,
                    website: profile.website ?? undefined,
                    address: profile.address ?? undefined,
                    city: profile.city ?? undefined,
                    district: profile.district ?? undefined,
                    logo_url: profile.logo_url ?? undefined,
                  });
                }
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Read-only fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Label className="text-gray-300">College Code</Label>
            <p className="text-white font-mono mt-1">{profile?.code}</p>
          </div>
          <div>
            <Label className="text-gray-300">NMC Registration Number</Label>
            <p className="text-white font-mono mt-1">
              {profile?.nmc_registration_number || '—'}
            </p>
          </div>
          <div>
            <Label className="text-gray-300">University Affiliation</Label>
            <p className="text-white mt-1">{profile?.university_affiliation || '—'}</p>
          </div>
          <div>
            <Label className="text-gray-300">State</Label>
            <p className="text-white mt-1">{profile?.state}</p>
          </div>
          <div>
            <Label className="text-gray-300">Established Year</Label>
            <p className="text-white mt-1">{profile?.established_year || '—'}</p>
          </div>
          <div>
            <Label className="text-gray-300">College Type</Label>
            <Badge
              variant="outline"
              className="mt-1"
            >
              {profile?.college_type || 'Unknown'}
            </Badge>
          </div>
          <div>
            <Label className="text-gray-300">Sanctioned Intake</Label>
            <p className="text-white mt-1">{profile?.sanctioned_intake}</p>
          </div>
          <div>
            <Label className="text-gray-300">Total Intake</Label>
            <p className="text-white mt-1">{profile?.total_intake}</p>
          </div>
        </div>

        {/* Editable fields */}
        <div className="border-t border-[#262626] pt-6 mt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Editable Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="name" className="text-gray-300">
                College Name *
              </Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="phone" className="text-gray-300">
                Phone
              </Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-gray-300">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="website" className="text-gray-300">
                Website
              </Label>
              <Input
                id="website"
                type="url"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="city" className="text-gray-300">
                City
              </Label>
              <Input
                id="city"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="district" className="text-gray-300">
                District
              </Label>
              <Input
                id="district"
                value={formData.district || ''}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="address" className="text-gray-300">
                Address
              </Label>
              <Input
                id="address"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="logo_url" className="text-gray-300">
                Logo URL
              </Label>
              <Input
                id="logo_url"
                type="url"
                value={formData.logo_url || ''}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                disabled={!isEditing}
                placeholder="https://example.com/logo.png"
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Academic Configuration Section
// ---------------------------------------------------------------------------

interface AcademicConfig {
  attendance_threshold_min?: number;
  attendance_threshold_ia?: number;
  attendance_max_condonation?: number;
  teaching_weeks_per_year?: number;
  working_days_per_week?: number;
  academic_calendar_start?: string;
  semesters_per_year?: number;
  exam_pattern?: string;
  timezone?: string;
  languages?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
}

function AcademicConfigSection() {
  const { data: profile, isLoading, error } = useCollegeProfile();
  const updateMutation = useUpdateCollegeProfile();

  const [config, setConfig] = useState<AcademicConfig>({});
  const [isEditing, setIsEditing] = useState(false);

  // Sync config when profile loads
  useMemo(() => {
    if (profile?.config && !isEditing) {
      setConfig(profile.config as AcademicConfig);
    }
  }, [profile, isEditing]);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({ config });
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update configuration:', err);
      alert(err instanceof Error ? err.message : 'Failed to update configuration');
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-[#141414] border-[#262626]">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-[#141414] border-[#262626]">
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-400">Failed to load academic configuration</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#141414] border-[#262626]">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-white">Academic Configuration</CardTitle>
          <CardDescription className="text-gray-400">
            Configure academic calendar, attendance, and examination parameters
          </CardDescription>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
            Edit Configuration
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setIsEditing(false);
                if (profile?.config) setConfig(profile.config as AcademicConfig);
              }}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Attendance Configuration */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Attendance Thresholds</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="attendance_min" className="text-gray-300">
                Minimum Attendance (%) *
              </Label>
              <Input
                id="attendance_min"
                type="number"
                min={0}
                max={100}
                value={config?.attendance_threshold_min ?? 75}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    attendance_threshold_min: parseInt(e.target.value) || 75,
                  })
                }
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 75%</p>
            </div>
            <div>
              <Label htmlFor="attendance_ia" className="text-gray-300">
                IA Eligibility (%) *
              </Label>
              <Input
                id="attendance_ia"
                type="number"
                min={0}
                max={100}
                value={config?.attendance_threshold_ia ?? 50}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    attendance_threshold_ia: parseInt(e.target.value) || 50,
                  })
                }
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum for IA participation</p>
            </div>
            <div>
              <Label htmlFor="attendance_condonation" className="text-gray-300">
                Max Condonation (%) *
              </Label>
              <Input
                id="attendance_condonation"
                type="number"
                min={0}
                max={100}
                value={config?.attendance_max_condonation ?? 10}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    attendance_max_condonation: parseInt(e.target.value) || 10,
                  })
                }
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Maximum allowed condonation</p>
            </div>
          </div>
        </div>

        {/* Academic Calendar */}
        <div className="border-t border-[#262626] pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Academic Calendar</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="teaching_weeks" className="text-gray-300">
                Teaching Weeks per Year *
              </Label>
              <Input
                id="teaching_weeks"
                type="number"
                min={1}
                max={52}
                value={config?.teaching_weeks_per_year ?? 39}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    teaching_weeks_per_year: parseInt(e.target.value) || 39,
                  })
                }
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">NMC minimum: 39 weeks</p>
            </div>
            <div>
              <Label htmlFor="working_days" className="text-gray-300">
                Working Days per Week *
              </Label>
              <Input
                id="working_days"
                type="number"
                min={1}
                max={7}
                value={config?.working_days_per_week ?? 6}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    working_days_per_week: parseInt(e.target.value) || 6,
                  })
                }
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Typical: 6 days</p>
            </div>
            <div>
              <Label htmlFor="academic_start" className="text-gray-300">
                Academic Year Start Month
              </Label>
              <Select
                value={config?.academic_calendar_start ?? 'august'}
                onValueChange={(value) =>
                  setConfig({ ...config, academic_calendar_start: value })
                }
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    'January',
                    'February',
                    'March',
                    'April',
                    'May',
                    'June',
                    'July',
                    'August',
                    'September',
                    'October',
                    'November',
                    'December',
                  ].map((month) => (
                    <SelectItem key={month.toLowerCase()} value={month.toLowerCase()}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Semester Structure */}
        <div className="border-t border-[#262626] pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Semester Structure</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="semesters_per_year" className="text-gray-300">
                Semesters per Year
              </Label>
              <Select
                value={(config?.semesters_per_year ?? 2).toString()}
                onValueChange={(value) =>
                  setConfig({ ...config, semesters_per_year: parseInt(value) })
                }
                disabled={!isEditing}
              >
                <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Annual (1 semester)</SelectItem>
                  <SelectItem value="2">Semester (2 per year)</SelectItem>
                  <SelectItem value="3">Trimester (3 per year)</SelectItem>
                  <SelectItem value="4">Quarter (4 per year)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="exam_pattern" className="text-gray-300">
                Examination Pattern
              </Label>
              <Input
                id="exam_pattern"
                value={config?.exam_pattern ?? 'Internal + University Exam'}
                onChange={(e) => setConfig({ ...config, exam_pattern: e.target.value })}
                disabled={!isEditing}
                placeholder="e.g., Internal + University Exam"
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
          </div>
        </div>

        {/* Other Settings */}
        <div className="border-t border-[#262626] pt-6">
          <h3 className="text-lg font-semibold text-white mb-4">Other Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="timezone" className="text-gray-300">
                Timezone
              </Label>
              <Input
                id="timezone"
                value={config?.timezone ?? 'Asia/Kolkata'}
                onChange={(e) => setConfig({ ...config, timezone: e.target.value })}
                disabled={!isEditing}
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
            <div>
              <Label htmlFor="languages" className="text-gray-300">
                Languages (comma-separated)
              </Label>
              <Input
                id="languages"
                value={
                  Array.isArray(config?.languages)
                    ? config.languages.join(', ')
                    : config?.languages ?? 'English'
                }
                onChange={(e) =>
                  setConfig({
                    ...config,
                    languages: e.target.value.split(',').map((l) => l.trim()),
                  })
                }
                disabled={!isEditing}
                placeholder="English, Hindi, Kannada"
                className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Audit Log Section
// ---------------------------------------------------------------------------

function AuditLogSection() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [filters, setFilters] = useState<{
    action?: string;
    entity_type?: string;
    start_date?: string;
    end_date?: string;
  }>({});

  const { data, isLoading, error } = useAuditLog({
    page,
    page_size: pageSize,
    ...filters,
  });

  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());

  const toggleChanges = (id: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChanges(newExpanded);
  };

  return (
    <Card className="bg-[#141414] border-[#262626]">
      <CardHeader>
        <CardTitle className="text-white">Audit Log</CardTitle>
        <CardDescription className="text-gray-400">
          Track all system changes and user actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="action" className="text-gray-300">
              Action
            </Label>
            <Select
              value={filters.action ?? 'all'}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  action: value === 'all' ? undefined : value,
                })
              }
            >
              <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="create">Create</SelectItem>
                <SelectItem value="update">Update</SelectItem>
                <SelectItem value="delete">Delete</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="entity_type" className="text-gray-300">
              Entity Type
            </Label>
            <Select
              value={filters.entity_type ?? 'all'}
              onValueChange={(value) =>
                setFilters({
                  ...filters,
                  entity_type: value === 'all' ? undefined : value,
                })
              }
            >
              <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="faculty">Faculty</SelectItem>
                <SelectItem value="assessment">Assessment</SelectItem>
                <SelectItem value="fee_payment">Fee Payment</SelectItem>
                <SelectItem value="department">Department</SelectItem>
                <SelectItem value="college">College</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="start_date" className="text-gray-300">
              Start Date
            </Label>
            <Input
              id="start_date"
              type="date"
              value={filters.start_date ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, start_date: e.target.value || undefined })
              }
              className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
            />
          </div>
          <div>
            <Label htmlFor="end_date" className="text-gray-300">
              End Date
            </Label>
            <Input
              id="end_date"
              type="date"
              value={filters.end_date ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, end_date: e.target.value || undefined })
              }
              className="bg-[#1E1E1E] border-[#262626] text-white mt-1"
            />
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-400">Failed to load audit log</p>
            </div>
          </div>
        ) : !data?.data || data.data.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No audit log entries found</p>
          </div>
        ) : (
          <>
            <div className="border border-[#262626] rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1E1E1E] border-[#262626] hover:bg-[#1E1E1E]">
                    <TableHead className="text-gray-300">Timestamp</TableHead>
                    <TableHead className="text-gray-300">Action</TableHead>
                    <TableHead className="text-gray-300">Entity Type</TableHead>
                    <TableHead className="text-gray-300">Entity ID</TableHead>
                    <TableHead className="text-gray-300">User</TableHead>
                    <TableHead className="text-gray-300">Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((log: AuditLogResponse) => (
                    <TableRow key={log.id} className="border-[#262626]">
                      <TableCell className="text-gray-300 font-mono text-xs">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            log.action === 'delete'
                              ? 'destructive'
                              : log.action === 'create'
                                ? 'default'
                                : 'outline'
                          }
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-gray-300">{log.entity_type}</TableCell>
                      <TableCell className="text-gray-400 font-mono text-xs">
                        {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : '—'}
                      </TableCell>
                      <TableCell className="text-gray-400 font-mono text-xs">
                        {log.user_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {log.changes ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleChanges(log.id)}
                            className="text-emerald-500 hover:text-emerald-400 p-0 h-auto"
                          >
                            {expandedChanges.has(log.id) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            View Changes
                          </Button>
                        ) : (
                          <span className="text-gray-500 text-sm">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.data.map(
                    (log: AuditLogResponse) =>
                      expandedChanges.has(log.id) &&
                      log.changes && (
                        <TableRow key={`${log.id}-changes`} className="border-[#262626]">
                          <TableCell colSpan={6} className="bg-[#0A0A0A]">
                            <div className="p-4 space-y-2">
                              <h4 className="text-sm font-semibold text-white mb-2">
                                Changed Fields:
                              </h4>
                              <pre className="text-xs text-gray-300 bg-[#1E1E1E] p-3 rounded overflow-x-auto">
                                {JSON.stringify(log.changes, null, 2)}
                              </pre>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-sm text-gray-400">
                  Showing {(page - 1) * pageSize + 1} to{' '}
                  {Math.min(page * pageSize, data.total)} of {data.total} entries
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button
                    onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                    disabled={page === data.total_pages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// TODO Placeholder Component
// ---------------------------------------------------------------------------

function TodoPlaceholder({
  title,
  description,
  features,
}: {
  title: string;
  description: string;
  features: string[];
}) {
  return (
    <Card className="bg-[#141414] border-[#262626]">
      <CardHeader>
        <CardTitle className="text-white">{title}</CardTitle>
        <CardDescription className="text-gray-400">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-[#1E1E1E] border border-[#262626] rounded-lg p-8 text-center">
          <div className="max-w-md mx-auto">
            <SettingsIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Coming Soon</h3>
            <p className="text-gray-400 mb-6">
              This feature is currently under development.
            </p>
            <div className="text-left">
              <p className="text-sm text-gray-400 mb-2">Planned features:</p>
              <ul className="space-y-1">
                {features.map((feature, idx) => (
                  <li key={idx} className="text-sm text-gray-500 flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

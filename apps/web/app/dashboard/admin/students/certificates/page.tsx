'use client';

import { useState } from 'react';
import {
  BadgeCheck,
  Clock,
  BarChart3,
  PlusCircle,
  Search,
  Printer,
  Filter,
  RefreshCw,
  Download,
  QrCode,
  ShieldCheck,
  Ban,
  Check,
  ExternalLink,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCertificates,
  useGenerateCertificate,
  useRevokeCertificate,
} from '@/lib/hooks/admin/use-certificates';
import { useStudents } from '@/lib/hooks/admin/use-students';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const CERTIFICATE_TYPES = [
  { value: 'bonafide', label: 'Bonafide Certificate' },
  { value: 'migration', label: 'Migration Certificate' },
  { value: 'transfer', label: 'Transfer Certificate (TC)' },
  { value: 'character', label: 'Character Certificate' },
  { value: 'noc', label: 'No Objection Certificate (NOC)' },
  { value: 'fee_paid', label: 'Fee Paid Certificate' },
  { value: 'course_completion', label: 'Course Completion' },
  { value: 'custom', label: 'Custom Certificate' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CertificateManagementPage() {
  // Generate form state
  const [certType, setCertType] = useState('bonafide');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    null,
  );
  const [purpose, setPurpose] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  // Filter state
  const [filterCertType, setFilterCertType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // API calls
  const {
    data: certificatesData,
    isLoading: certificatesLoading,
    error: certificatesError,
  } = useCertificates({
    certificate_type: filterCertType || undefined,
    status: filterStatus || undefined,
    search: searchQuery || undefined,
    page_size: 50,
  });

  const {
    data: studentsData,
    isLoading: studentsLoading,
  } = useStudents(
    { search: studentSearch, page_size: 20 },
    { enabled: studentSearch.length >= 2 },
  );

  const generateMutation = useGenerateCertificate();
  const revokeMutation = useRevokeCertificate();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleGenerateCertificate = async () => {
    if (!selectedStudentId) {
      alert('Please select a student');
      return;
    }

    // Validate purpose for certificate types that require it
    if (['bonafide', 'noc', 'custom'].includes(certType) && !purpose.trim()) {
      alert('Purpose is required for this certificate type');
      return;
    }

    try {
      const result = await generateMutation.mutateAsync({
        student_id: selectedStudentId,
        certificate_type: certType,
        purpose: purpose || null,
      });

      setSuccessMessage(
        `Certificate generated successfully! Certificate Number: ${result.certificate_number}`,
      );

      // Reset form
      setCertType('bonafide');
      setStudentSearch('');
      setSelectedStudentId(null);
      setPurpose('');

      // Auto-download if file_url is present
      if (result.file_url) {
        window.open(result.file_url, '_blank');
      }

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      alert('Failed to generate certificate. Please try again.');
    }
  };

  const handleRevokeClick = (certId: string) => {
    setRevokeConfirmId(certId);
    setRevokeReason('');
  };

  const handleRevokeConfirm = async () => {
    if (!revokeConfirmId || !revokeReason.trim()) return;

    try {
      await revokeMutation.mutateAsync({
        id: revokeConfirmId,
        data: { revocation_reason: revokeReason },
      });
      setRevokeConfirmId(null);
      setRevokeReason('');
      setSuccessMessage('Certificate revoked successfully');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Failed to revoke certificate:', error);
      alert('Failed to revoke certificate. Please try again.');
    }
  };

  const handleStudentSelect = (studentId: string, studentName: string) => {
    setSelectedStudentId(studentId);
    setStudentSearch(studentName);
    setShowStudentDropdown(false);
  };

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const certificates = certificatesData?.data || [];
  const students = studentsData?.data || [];

  const stats = {
    total: certificatesData?.total || 0,
    pending: certificates.filter((c) => c.status === 'requested').length,
    issued: certificates.filter((c) => c.status === 'issued').length,
    revoked: certificates.filter((c) => c.status === 'revoked').length,
  };

  // Sample QR verification URL
  const sampleQRUrl =
    certificates.length > 0 && certificates[0].qr_verification_url
      ? certificates[0].qr_verification_url
      : 'https://verify.acolyte.ai/cert/SAMPLE-2025-001';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'issued':
        return (
          <Badge variant="default" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            Issued
          </Badge>
        );
      case 'generated':
        return (
          <Badge variant="default" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
            Generated
          </Badge>
        );
      case 'requested':
        return (
          <Badge variant="warning" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
            Requested
          </Badge>
        );
      case 'signed':
        return (
          <Badge variant="default" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
            Signed
          </Badge>
        );
      case 'revoked':
        return (
          <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20">
            Revoked
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCertTypeName = (type: string) => {
    const found = CERTIFICATE_TYPES.find((t) => t.value === type);
    return found ? found.label : type;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (certificatesError) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center bg-[#0A0A0A]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-2 text-sm text-gray-400">
            Failed to load certificates data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Success Message */}
      {successMessage && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Check className="h-5 w-5" />
            <p className="text-sm font-medium">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-gray-400">Total Issued</p>
              <h3 className="mt-1 text-2xl font-bold text-white">
                {certificatesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  stats.total
                )}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
              <BadgeCheck className="h-5 w-5 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-gray-400">
                Pending Requests
              </p>
              <h3 className="mt-1 text-2xl font-bold text-white">
                {certificatesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  stats.pending
                )}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-500/10">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-gray-400">Issued</p>
              <h3 className="mt-1 text-2xl font-bold text-white">
                {certificatesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  stats.issued
                )}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <BarChart3 className="h-5 w-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium text-gray-400">Revoked</p>
              <h3 className="mt-1 text-2xl font-bold text-white">
                {certificatesLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  stats.revoked
                )}
              </h3>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
              <Ban className="h-5 w-5 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content: Generate Form + Certificate Log */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Generate Certificate Form */}
        <div className="xl:col-span-1">
          <Card className="flex h-full flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-[#1E1E1E] p-5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <PlusCircle className="h-5 w-5 text-emerald-500" />
                Generate Certificate
              </CardTitle>
            </CardHeader>

            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* Certificate Type */}
              <div className="space-y-2">
                <Label className="text-gray-300">Certificate Type</Label>
                <Select value={certType} onValueChange={setCertType}>
                  <SelectTrigger className="border-[#1E1E1E] bg-[#141414] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CERTIFICATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student Search */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Student Search <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setShowStudentDropdown(e.target.value.length >= 2);
                    }}
                    onFocus={() => {
                      if (studentSearch.length >= 2) {
                        setShowStudentDropdown(true);
                      }
                    }}
                    placeholder="Search by Name or Enrollment No..."
                    className="border-[#1E1E1E] bg-[#141414] pl-10 pr-10 text-white placeholder:text-gray-500"
                  />
                  {studentsLoading && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-500" />
                  )}
                </div>

                {/* Student Dropdown */}
                {showStudentDropdown && students.length > 0 && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-[#1E1E1E] bg-[#141414] shadow-lg">
                    {students.map((student) => (
                      <button
                        key={student.id}
                        onClick={() =>
                          handleStudentSelect(student.id, student.name)
                        }
                        className="flex w-full items-center gap-3 border-b border-[#1E1E1E] p-3 text-left hover:bg-[#262626]"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-white">
                            {student.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {student.enrollment_number || 'N/A'}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Purpose */}
              <div className="space-y-2">
                <Label className="text-gray-300">
                  Purpose / Reason{' '}
                  {['bonafide', 'noc', 'custom'].includes(certType) && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. For Passport Application"
                  className="border-[#1E1E1E] bg-[#141414] text-white placeholder:text-gray-500"
                />
                <p className="text-xs text-gray-500">
                  {['bonafide', 'noc', 'custom'].includes(certType)
                    ? 'Required for this certificate type'
                    : 'Optional'}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 border-t border-[#1E1E1E] p-5">
              <Button
                onClick={handleGenerateCertificate}
                disabled={generateMutation.isPending || !selectedStudentId}
                className="w-full shadow-lg shadow-emerald-500/20"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" /> Generate Certificate
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>

        {/* Certificate Log + Verification Banner */}
        <div className="flex flex-col gap-6 xl:col-span-2">
          {/* Certificate Log Table */}
          <Card className="flex flex-1 flex-col">
            <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-[#1E1E1E] p-5">
              <CardTitle className="text-lg">Certificate Log</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Filter className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="h-8 w-48 border-[#1E1E1E] bg-[#141414] pl-8 text-sm text-white placeholder:text-gray-500"
                  />
                </div>
                <Select value={filterCertType} onValueChange={setFilterCertType}>
                  <SelectTrigger className="h-8 w-40 border-[#1E1E1E] bg-[#141414] text-sm text-white">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Types</SelectItem>
                    {CERTIFICATE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 w-32 border-[#1E1E1E] bg-[#141414] text-sm text-white">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="generated">Generated</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="issued">Issued</SelectItem>
                    <SelectItem value="revoked">Revoked</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCertType('');
                    setFilterStatus('');
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <div className="flex-1 overflow-x-auto">
              {certificatesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : certificates.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  No certificates found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#1E1E1E] bg-[#262626]/50 hover:bg-[#262626]/50">
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Cert No.
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Type
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Purpose
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Date
                      </TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Status
                      </TableHead>
                      <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {certificates.map((cert) => {
                      const isRevoked = cert.status === 'revoked';
                      return (
                        <TableRow
                          key={cert.id}
                          className={`border-[#1E1E1E] hover:bg-[#262626]/50 ${isRevoked ? 'opacity-60' : ''}`}
                        >
                          <TableCell className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <QrCode className="h-4 w-4 text-gray-400" />
                              <span
                                className={`text-sm font-medium text-white ${isRevoked ? 'line-through' : ''}`}
                              >
                                {cert.certificate_number || 'N/A'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-300">
                            {getCertTypeName(cert.certificate_type)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate px-4 py-3 text-sm text-gray-300">
                            {cert.purpose || '—'}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm text-gray-300">
                            {cert.issued_date
                              ? new Date(cert.issued_date).toLocaleDateString()
                              : new Date(cert.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {getStatusBadge(cert.status)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right">
                            {isRevoked ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 cursor-not-allowed opacity-50"
                                disabled
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                {cert.file_url && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 hover:bg-emerald-500/10 hover:text-emerald-500"
                                    title="Download"
                                    onClick={() =>
                                      window.open(cert.file_url!, '_blank')
                                    }
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                {cert.qr_verification_url && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 hover:bg-blue-500/10 hover:text-blue-500"
                                    title="Verify"
                                    onClick={() =>
                                      window.open(
                                        cert.qr_verification_url!,
                                        '_blank',
                                      )
                                    }
                                  >
                                    <ShieldCheck className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 hover:bg-red-500/10 hover:text-red-500"
                                  title="Revoke"
                                  onClick={() => handleRevokeClick(cert.id)}
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Pagination */}
            {!certificatesLoading && certificatesData && (
              <div className="flex items-center justify-between border-t border-[#1E1E1E] p-4">
                <span className="text-xs text-gray-400">
                  Showing 1-{certificatesData.data.length} of{' '}
                  {certificatesData.total} entries
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={certificatesData.page === 1}
                    className="text-xs"
                  >
                    Previous
                  </Button>
                  <Button size="sm" className="px-3 text-xs">
                    {certificatesData.page}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={
                      certificatesData.page >= certificatesData.total_pages
                    }
                    className="text-xs"
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* QR Verification Banner */}
          <div className="relative flex flex-col items-center gap-6 overflow-hidden rounded-xl border border-[#1E1E1E] bg-gradient-to-r from-gray-900 to-gray-800 p-6 sm:flex-row">
            {/* Glow effect */}
            <div className="absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/2 rounded-full bg-emerald-500/5 blur-3xl" />

            {/* QR Icon */}
            <div className="z-10 shrink-0 rounded-lg bg-white p-3 shadow-xl">
              <QrCode className="h-16 w-16 text-gray-800" />
            </div>

            {/* Description */}
            <div className="z-10 flex-1 space-y-2 text-center sm:text-left">
              <h3 className="flex items-center justify-center gap-2 text-xl font-bold text-white sm:justify-start">
                <BadgeCheck className="h-5 w-5 text-emerald-500" />
                Instant Public Verification
              </h3>
              <p className="max-w-xl text-sm text-gray-400">
                Every certificate generated includes a unique, tamper-proof QR
                code. External parties can scan this code to instantly verify
                authenticity on our public portal.
              </p>
              <div className="pt-2">
                <a
                  href={sampleQRUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-xs font-medium text-emerald-500 transition-colors hover:text-emerald-400 sm:justify-start"
                >
                  View Sample Verification URL
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Revoke Confirmation Modal */}
      {revokeConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#1E1E1E] bg-[#141414] p-6">
            <div className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Ban className="h-5 w-5 text-red-500" />
              Revoke Certificate
            </div>
            <p className="mb-4 text-sm text-gray-400">
              Are you sure you want to revoke this certificate? This action
              cannot be undone. Please provide a reason for revocation.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-medium text-gray-400">
                Revocation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                placeholder="Explain why this certificate is being revoked..."
                rows={4}
                className="w-full rounded-lg border border-[#1E1E1E] bg-[#262626] p-2 text-sm text-gray-200 outline-none focus:border-red-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setRevokeConfirmId(null)}
                disabled={revokeMutation.isPending}
                className="flex-1 rounded border border-[#1E1E1E] bg-[#262626] py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-[#262626]/80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRevokeConfirm}
                disabled={revokeMutation.isPending || !revokeReason.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded bg-red-500 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {revokeMutation.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

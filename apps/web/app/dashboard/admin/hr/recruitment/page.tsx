'use client';

import { useState, useMemo } from 'react';
import {
  Plus,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ShieldCheck,
  Users,
  TrendingUp,
  ArrowRight,
  Filter,
  Search,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useRecruitmentPositions,
  useRecruitmentCandidates,
  useUpdateRecruitmentCandidate,
} from '@/lib/hooks/admin/use-recruitment';
import type {
  RecruitmentPositionResponse,
  RecruitmentCandidateResponse,
} from '@/types/admin-api';
import { cn } from '@/lib/utils';

const PRIORITY_COLORS = {
  critical: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const PIPELINE_STAGES = [
  { key: 'applied', label: 'Applied', color: 'bg-gray-500/10 text-gray-400' },
  { key: 'screening', label: 'Screening', color: 'bg-blue-500/10 text-blue-400' },
  { key: 'nmc_check', label: 'NMC Check', color: 'bg-purple-500/10 text-purple-400' },
  { key: 'interview', label: 'Interview', color: 'bg-yellow-500/10 text-yellow-400' },
  { key: 'offer', label: 'Offer', color: 'bg-orange-500/10 text-orange-400' },
  { key: 'joined', label: 'Joined', color: 'bg-emerald-500/10 text-emerald-400' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-500/10 text-red-400' },
] as const;

export default function RecruitmentPage() {
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const { data: positionsData, isLoading: loadingPositions, error: positionsError } =
    useRecruitmentPositions({
      status: statusFilter === 'all' ? undefined : statusFilter,
      priority: priorityFilter === 'all' ? undefined : priorityFilter,
      page_size: 50,
    });

  const positions = positionsData?.data ?? [];

  // Stats
  const stats = useMemo(() => {
    const totalPositions = positions.length;
    const criticalPositions = positions.filter((p) => p.priority === 'critical').length;
    const msrImpactPositions = positions.filter((p) => p.msr_impact).length;
    const openPositions = positions.filter((p) => p.status === 'open').length;

    return { totalPositions, criticalPositions, msrImpactPositions, openPositions };
  }, [positions]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Faculty Recruitment</h1>
          <p className="text-gray-400 mt-2">
            Manage open positions and candidate pipeline
          </p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          New Position
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400">Total Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.totalPositions}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400">Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-500">{stats.openPositions}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400">Critical Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">{stats.criticalPositions}</div>
          </CardContent>
        </Card>

        <Card className="bg-[#141414] border-[#262626]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-400">MSR Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{stats.msrImpactPositions}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="bg-[#141414] border-[#262626]">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="status" className="text-gray-300">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="screening">Screening</SelectItem>
                  <SelectItem value="interview">Interview</SelectItem>
                  <SelectItem value="offered">Offered</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority" className="text-gray-300">
                Priority
              </Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                }}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positions Grid */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Open Positions</h2>

        {loadingPositions ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : positionsError ? (
          <Card className="bg-[#141414] border-[#262626]">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-400">Failed to load positions</p>
              </div>
            </CardContent>
          </Card>
        ) : positions.length === 0 ? (
          <Card className="bg-[#141414] border-[#262626]">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Users className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No positions found</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {positions.map((position) => (
              <PositionCard
                key={position.id}
                position={position}
                onClick={() => setSelectedPositionId(position.id)}
                isSelected={selectedPositionId === position.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Candidate Pipeline */}
      {selectedPositionId && (
        <CandidatePipeline positionId={selectedPositionId} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Position Card Component
// ---------------------------------------------------------------------------

function PositionCard({
  position,
  onClick,
  isSelected,
}: {
  position: RecruitmentPositionResponse;
  onClick: () => void;
  isSelected: boolean;
}) {
  const { data: candidatesData } = useRecruitmentCandidates({ position_id: position.id });
  const candidateCount = candidatesData?.total ?? 0;

  const toRupees = (paisa: number | null) => {
    if (!paisa) return 0;
    return paisa / 100;
  };

  return (
    <Card
      className={cn(
        'bg-[#141414] border-[#262626] cursor-pointer transition-all hover:border-emerald-500/50',
        isSelected && 'border-emerald-500 ring-2 ring-emerald-500/20'
      )}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <Badge
            variant="outline"
            className={cn('text-xs', PRIORITY_COLORS[position.priority as keyof typeof PRIORITY_COLORS])}
          >
            {position.priority}
          </Badge>
          {position.msr_impact && (
            <Badge variant="destructive" className="text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              MSR Impact
            </Badge>
          )}
        </div>
        <CardTitle className="text-white text-lg">{position.designation}</CardTitle>
        <CardDescription className="text-gray-400">
          {position.specialization_required || 'No specialization specified'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Vacancies:</span>
          <span className="text-white font-semibold">{position.vacancies}</span>
        </div>

        {position.qualification_required && (
          <div className="text-xs text-gray-500 border-t border-[#262626] pt-2">
            <p className="font-medium text-gray-400 mb-1">Qualification:</p>
            <p>{position.qualification_required}</p>
          </div>
        )}

        {(position.salary_range_min || position.salary_range_max) && (
          <div className="text-xs text-gray-500 border-t border-[#262626] pt-2">
            <p className="font-medium text-gray-400 mb-1">Salary Range:</p>
            <p>
              ₹{toRupees(position.salary_range_min).toLocaleString()} -{' '}
              ₹{toRupees(position.salary_range_max).toLocaleString()}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-[#262626] pt-3">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            <span>{candidateCount} applicant{candidateCount !== 1 ? 's' : ''}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {position.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Candidate Pipeline Component
// ---------------------------------------------------------------------------

function CandidatePipeline({ positionId }: { positionId: string }) {
  const { data: candidatesData, isLoading } = useRecruitmentCandidates({
    position_id: positionId,
    page_size: 100,
  });

  const candidates = candidatesData?.data ?? [];

  // Group candidates by pipeline stage
  const candidatesByStage = useMemo(() => {
    const groups: Record<string, RecruitmentCandidateResponse[]> = {
      applied: [],
      screening: [],
      nmc_check: [],
      interview: [],
      offer: [],
      joined: [],
      rejected: [],
    };

    candidates.forEach((candidate) => {
      groups[candidate.pipeline_stage].push(candidate);
    });

    return groups;
  }, [candidates]);

  return (
    <Card className="bg-[#141414] border-[#262626]">
      <CardHeader>
        <CardTitle className="text-white">Candidate Pipeline</CardTitle>
        <CardDescription className="text-gray-400">
          Track candidates through recruitment stages
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
            {PIPELINE_STAGES.map((stage) => (
              <PipelineColumn
                key={stage.key}
                stage={stage}
                candidates={candidatesByStage[stage.key] || []}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Pipeline Column Component
// ---------------------------------------------------------------------------

function PipelineColumn({
  stage,
  candidates,
}: {
  stage: { key: string; label: string; color: string };
  candidates: RecruitmentCandidateResponse[];
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
        <Badge variant="outline" className={cn('text-xs', stage.color)}>
          {candidates.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {candidates.length === 0 ? (
          <div className="text-center py-8 bg-[#1E1E1E] border border-[#262626] rounded-lg">
            <p className="text-xs text-gray-500">No candidates</p>
          </div>
        ) : (
          candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Candidate Card Component
// ---------------------------------------------------------------------------

function CandidateCard({ candidate }: { candidate: RecruitmentCandidateResponse }) {
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetStage, setTargetStage] = useState<string>(candidate.pipeline_stage);
  const updateMutation = useUpdateRecruitmentCandidate(candidate.id);

  const handleMove = async () => {
    if (targetStage === candidate.pipeline_stage) {
      setShowMoveDialog(false);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        pipeline_stage: targetStage as any,
      });
      setShowMoveDialog(false);
    } catch (err) {
      console.error('Failed to update candidate:', err);
      alert(err instanceof Error ? err.message : 'Failed to update candidate');
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
      <DialogTrigger asChild>
        <Card className="bg-[#1E1E1E] border-[#262626] cursor-pointer hover:border-emerald-500/50 transition-all">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-semibold">
                {getInitials(candidate.name)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{candidate.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {candidate.qualification || 'No qualification'}
                </p>
              </div>
            </div>

            {/* NMC Eligibility Badge */}
            {candidate.nmc_eligible !== null && (
              <div className="flex items-center gap-1">
                {candidate.nmc_eligible ? (
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    NMC Eligible
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">
                    <XCircle className="h-3 w-3 mr-1" />
                    Not Eligible
                  </Badge>
                )}
              </div>
            )}

            {candidate.experience_years !== null && (
              <p className="text-xs text-gray-500">
                {candidate.experience_years} years exp
              </p>
            )}
          </CardContent>
        </Card>
      </DialogTrigger>

      <DialogContent className="bg-[#141414] border-[#262626]">
        <DialogHeader>
          <DialogTitle className="text-white">Move Candidate</DialogTitle>
          <DialogDescription className="text-gray-400">
            Update {candidate.name}'s pipeline stage
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* Candidate Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Name:</span>
              <span className="text-white">{candidate.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Email:</span>
              <span className="text-white">{candidate.email || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Phone:</span>
              <span className="text-white">{candidate.phone || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Qualification:</span>
              <span className="text-white">{candidate.qualification || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Experience:</span>
              <span className="text-white">
                {candidate.experience_years ? `${candidate.experience_years} years` : '—'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Current Org:</span>
              <span className="text-white">{candidate.current_organization || '—'}</span>
            </div>
          </div>

          {/* NMC Eligibility */}
          {candidate.nmc_eligible !== null && (
            <div className="border-t border-[#262626] pt-4">
              <Label className="text-gray-300 mb-2 block">NMC Eligibility</Label>
              <div className="flex items-center gap-2">
                {candidate.nmc_eligible ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Eligible
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">
                    <XCircle className="h-4 w-4 mr-2" />
                    Not Eligible
                  </Badge>
                )}
              </div>
              {candidate.nmc_eligibility_notes && (
                <p className="text-xs text-gray-400 mt-2">
                  {candidate.nmc_eligibility_notes}
                </p>
              )}
            </div>
          )}

          {/* Stage Selector */}
          <div className="border-t border-[#262626] pt-4">
            <Label htmlFor="stage" className="text-gray-300">
              Move to Stage
            </Label>
            <Select value={targetStage} onValueChange={setTargetStage}>
              <SelectTrigger className="bg-[#1E1E1E] border-[#262626] text-white mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage.key} value={stage.key}>
                    {stage.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowMoveDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMove}
              disabled={updateMutation.isPending || targetStage === candidate.pipeline_stage}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

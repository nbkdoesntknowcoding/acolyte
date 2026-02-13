'use client';

/**
 * QR Print Page — Batch-generate printable QR sheets for campus deployment.
 *
 * Step 1: Select Mode B action points (grouped by building)
 * Step 2: Preview QR cards with size selector
 * Step 3: Print via browser dialog (clean 2×2 A4 layout)
 *
 * Endpoints used:
 *   GET  /api/v1/admin/qr/action-points
 *   GET  /api/v1/admin/qr/action-points/{id}/generate
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  CheckSquare,
  Square,
  Loader2,
  QrCode,
  MinusSquare,
} from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useActionPoints } from '@/lib/hooks/admin/use-action-points';
import { createAdminFetcher } from '@/lib/api/admin-client-browser';
import type { QRActionPoint, GeneratedQR } from '@/types/admin';

// ---------------------------------------------------------------------------
// Instruction text per action_type
// ---------------------------------------------------------------------------

const INSTRUCTION_TEXT: Record<string, string> = {
  mess_entry: 'Show your QR at the scanner to enter',
  library_checkout: 'Scan this QR to check out this book',
  library_return: 'Scan this QR to return books',
  attendance_mark: 'Scan this QR to mark attendance',
  hostel_checkin: 'Show your QR at the gate scanner',
  clinical_posting: 'Scan this QR for rotation check-in',
  equipment_checkout: 'Scan this QR to check out equipment',
  event_checkin: 'Scan this QR to register attendance',
  exam_hall_entry: 'Show your QR at the exam hall scanner',
  library_visit: 'Scan this QR at the library entrance',
  lab_access: 'Scan this QR for lab access',
  sports_facility: 'Scan this QR for sports facility entry',
  parking_entry: 'Scan this QR for parking entry',
  custom: 'Scan this QR code',
};

const ACTION_ICON: Record<string, string> = {
  mess_entry: '\uD83C\uDF5D',
  library_checkout: '\uD83D\uDCDA',
  library_return: '\uD83D\uDCDA',
  attendance_mark: '\u2705',
  hostel_checkin: '\uD83C\uDFE0',
  clinical_posting: '\uD83C\uDFE5',
  equipment_checkout: '\uD83D\uDD27',
  event_checkin: '\uD83C\uDFAB',
  exam_hall_entry: '\uD83D\uDCDD',
  library_visit: '\uD83D\uDCDA',
  lab_access: '\uD83E\uDDEA',
  sports_facility: '\u26BD',
  parking_entry: '\uD83C\uDD7F\uFE0F',
  custom: '\uD83D\uDD18',
};

const SIZE_OPTIONS = [
  { label: 'Small (5cm)', value: 'small', imgPx: 120, cardPx: 200 },
  { label: 'Medium (8cm)', value: 'medium', imgPx: 180, cardPx: 280 },
  { label: 'Large (12cm)', value: 'large', imgPx: 260, cardPx: 380 },
] as const;

type SizeValue = (typeof SIZE_OPTIONS)[number]['value'];

interface GeneratedCard {
  point: QRActionPoint;
  qr: GeneratedQR & { action_type: string };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function QRPrintPage() {
  const { data: actionPoints, isLoading } = useActionPoints(
    { is_active: true, page_size: 200 },
  );
  const { getToken } = useAuth();

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Generated QR cards
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [generating, setGenerating] = useState(false);

  // Size
  const [size, setSize] = useState<SizeValue>('medium');
  const sizeConfig = SIZE_OPTIONS.find((s) => s.value === size) ?? SIZE_OPTIONS[1];

  // Filter to Mode B only (Mode A uses scanner, doesn't need printed QR)
  const modeBPoints = useMemo(
    () => (actionPoints ?? []).filter((p) => p.qr_mode === 'mode_b'),
    [actionPoints],
  );

  // Group by building
  const grouped = useMemo(() => {
    const map = new Map<string, QRActionPoint[]>();
    modeBPoints.forEach((p) => {
      const building = p.building || 'Unassigned';
      if (!map.has(building)) map.set(building, []);
      map.get(building)!.push(p);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [modeBPoints]);

  // Toggle selection
  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (points: QRActionPoint[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = points.every((p) => prev.has(p.id));
      if (allSelected) {
        points.forEach((p) => next.delete(p.id));
      } else {
        points.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  // Generate QR codes for selected points
  const generate = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    try {
      const fetcher = createAdminFetcher(getToken);
      const results: GeneratedCard[] = [];
      // Generate in parallel (batches of 5 to avoid rate limits)
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 5) {
        const batch = ids.slice(i, i + 5);
        const batchResults = await Promise.all(
          batch.map(async (id) => {
            const point = modeBPoints.find((p) => p.id === id);
            if (!point) return null;
            const qr = await fetcher<GeneratedQR & { action_type: string }>(
              `/qr/action-points/${id}/generate`,
            );
            return { point, qr };
          }),
        );
        results.push(...(batchResults.filter(Boolean) as GeneratedCard[]));
      }
      setCards(results);
    } catch {
      // error handling is visual — user sees no cards
    } finally {
      setGenerating(false);
    }
  }, [selectedIds, getToken, modeBPoints]);

  // Print
  const handlePrint = () => window.print();

  // Step state
  const showPreview = cards.length > 0;

  return (
    <>
      {/* Screen-only UI */}
      <div className="print:hidden space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/admin/qr">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white">Print QR Codes</h1>
              <p className="text-sm text-gray-400">
                Generate printable QR sheets for campus deployment
              </p>
            </div>
          </div>
          {showPreview && (
            <div className="flex items-center gap-3">
              {/* Size selector */}
              <div className="flex rounded-lg border border-dark-border">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSize(opt.value)}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors first:rounded-l-lg last:rounded-r-lg ${
                      size === opt.value
                        ? 'bg-emerald-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <Button onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print All ({cards.length})
              </Button>
            </div>
          )}
        </div>

        {/* Step 1: Select Action Points */}
        {!showPreview && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300">
                Select Mode B action points to generate printable QR codes.
                {selectedIds.size > 0 && (
                  <span className="ml-2 font-medium text-emerald-400">
                    {selectedIds.size} of {modeBPoints.length} selected
                  </span>
                )}
              </p>
              <Button
                onClick={generate}
                disabled={selectedIds.size === 0 || generating}
              >
                {generating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate QR Codes ({selectedIds.size})
                  </>
                )}
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : modeBPoints.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <QrCode className="mb-3 h-10 w-10 text-gray-600" />
                <p className="text-sm text-gray-400">
                  No Mode B action points found
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Mode B action points generate printable QR codes. Create some
                  first.
                </p>
                <Link href="/dashboard/admin/qr">
                  <Button variant="outline" size="sm" className="mt-4">
                    Go to Action Points
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map(([building, points]) => {
                  const allSelected = points.every((p) =>
                    selectedIds.has(p.id),
                  );
                  const someSelected =
                    !allSelected &&
                    points.some((p) => selectedIds.has(p.id));

                  return (
                    <div
                      key={building}
                      className="rounded-xl border border-dark-border bg-dark-surface"
                    >
                      <button
                        onClick={() => toggleGroup(points)}
                        className="flex w-full items-center gap-3 border-b border-dark-border px-4 py-3 text-left"
                      >
                        {allSelected ? (
                          <CheckSquare className="h-4 w-4 text-emerald-500" />
                        ) : someSelected ? (
                          <MinusSquare className="h-4 w-4 text-emerald-500/50" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="text-sm font-semibold text-white">
                          {building}
                        </span>
                        <span className="text-xs text-gray-500">
                          ({points.length})
                        </span>
                      </button>
                      <div className="divide-y divide-dark-border">
                        {points.map((point) => (
                          <button
                            key={point.id}
                            onClick={() => toggle(point.id)}
                            className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-dark-elevated/50"
                          >
                            {selectedIds.has(point.id) ? (
                              <CheckSquare className="h-4 w-4 shrink-0 text-emerald-500" />
                            ) : (
                              <Square className="h-4 w-4 shrink-0 text-gray-600" />
                            )}
                            <div className="min-w-0 flex-1">
                              <span className="text-sm text-white">
                                {point.name}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {point.location_code}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {point.action_type.replace(/_/g, ' ')}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Step 2: Preview */}
        {showPreview && (
          <>
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCards([])}
              >
                <ArrowLeft className="mr-2 h-3.5 w-3.5" />
                Back to Selection
              </Button>
              <p className="text-sm text-gray-400">
                {cards.length} QR code{cards.length !== 1 ? 's' : ''} ready to
                print
              </p>
            </div>

            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${sizeConfig.cardPx}px, 1fr))`,
              }}
            >
              {cards.map(({ point, qr }) => (
                <QRCard
                  key={point.id}
                  point={point}
                  qr={qr}
                  imgPx={sizeConfig.imgPx}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Print-only layout (hidden on screen) */}
      <div className="hidden print:block">
        <style>{`
          @media print {
            @page { margin: 10mm; }
            body { background: white !important; }
            .qr-print-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8mm;
            }
            .qr-print-card {
              border: 1px dashed #ccc;
              padding: 8mm;
              page-break-inside: avoid;
              text-align: center;
              background: white;
            }
            .qr-print-card img {
              image-rendering: pixelated;
              width: 60mm;
              height: 60mm;
              margin: 0 auto 4mm;
            }
            .qr-print-card .qr-name {
              font-size: 14pt;
              font-weight: 700;
              color: #000;
              margin-bottom: 2mm;
            }
            .qr-print-card .qr-instruction {
              font-size: 10pt;
              color: #333;
              margin-bottom: 2mm;
            }
            .qr-print-card .qr-location {
              font-size: 9pt;
              color: #666;
              margin-bottom: 1mm;
            }
            .qr-print-card .qr-code {
              font-size: 8pt;
              font-family: monospace;
              color: #999;
            }
          }
        `}</style>
        <div className="qr-print-grid">
          {cards.map(({ point, qr }) => (
            <div key={point.id} className="qr-print-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${qr.qr_image_base64}`}
                alt={`QR for ${point.name}`}
              />
              <div className="qr-name">{point.name}</div>
              <div className="qr-instruction">
                {ACTION_ICON[point.action_type] ?? '\uD83D\uDD18'}{' '}
                {INSTRUCTION_TEXT[point.action_type] ?? 'Scan this QR code'}
              </div>
              <div className="qr-location">
                {[point.building, point.floor != null ? `Floor ${point.floor}` : null]
                  .filter(Boolean)
                  .join(', ') || 'Campus'}
              </div>
              <div className="qr-code">{point.location_code}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// QR Card (screen preview)
// ---------------------------------------------------------------------------

function QRCard({
  point,
  qr,
  imgPx,
}: {
  point: QRActionPoint;
  qr: GeneratedQR & { action_type: string };
  imgPx: number;
}) {
  const instruction =
    INSTRUCTION_TEXT[point.action_type] ?? 'Scan this QR code';
  const icon = ACTION_ICON[point.action_type] ?? '\uD83D\uDD18';
  const label = point.action_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex flex-col items-center p-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${qr.qr_image_base64}`}
          alt={`QR for ${point.name}`}
          width={imgPx}
          height={imgPx}
          className="mb-3"
          style={{ imageRendering: 'pixelated' }}
        />
        <p className="text-base font-bold text-white">{point.name}</p>
        <p className="mt-1 text-sm text-gray-400">
          {[point.building, point.floor != null ? `Floor ${point.floor}` : null]
            .filter(Boolean)
            .join(', ') || 'Campus'}
        </p>
        <p className="mt-0.5 font-mono text-xs text-gray-600">
          {point.location_code}
        </p>
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <span>{icon}</span>
          <span>{label}</span>
        </div>
        <p className="mt-1 text-xs italic text-gray-500">{instruction}</p>
      </CardContent>
    </Card>
  );
}

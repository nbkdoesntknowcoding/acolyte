"use client";

import {
  User,
  Briefcase,
  CheckCircle,
  Lock,
  Phone,
  FileText,
  Image,
  Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type {
  FacultyBasicInfo,
  FacultyServiceDetails,
  FacultyRegistrationId,
  FacultyEmergencyContact,
  FacultyDocumentItem,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// TODO: Replace with API call — GET /api/v1/admin/faculty/{id}/personal
// ---------------------------------------------------------------------------

const BASIC_INFO: FacultyBasicInfo = {
  fullName: "Dr. Sunil Kumar",
  dob: "15 May 1978 (46 Years)",
  gender: "Male",
  maritalStatus: "Married",
  fatherName: "Mr. Ramesh Kumar",
  nationality: "Indian",
  address:
    "A-102, Faculty Quarters, Acolyte Medical College Campus, Green Valley, New Delhi - 110001",
};

const SERVICE_DETAILS: FacultyServiceDetails = {
  dateOfJoining: "12 August 2010",
  designationAtJoining: "Assistant Professor",
  employmentType: "Regular / Permanent",
  retirementDate: "31 May 2038",
  retirementCountdown: "14 Years left",
  lastPromotionDate: "01 July 2018",
};

const REGISTRATION_IDS: FacultyRegistrationId[] = [
  {
    label: "NMC Registration",
    value: "MCI-12345/2000",
    subLabel: "State: Delhi Medical Council",
    verified: true,
  },
  {
    label: "AEBAS ID",
    value: "10029388",
    subLabel: "Last Sync: Today, 09:00 AM",
    verified: true,
  },
  { label: "PAN Card", value: "ABCDE1234F", verified: false, locked: true },
  {
    label: "Aadhar Number",
    value: "XXXX-XXXX-9876",
    verified: false,
    locked: true,
  },
];

const EMERGENCY_CONTACT: FacultyEmergencyContact = {
  name: "Mrs. Meena Kumar",
  initials: "MK",
  relation: "Wife",
  phone: "+91 98765 00000",
};

const DOCUMENTS: FacultyDocumentItem[] = [
  { name: "Appointment Letter.pdf", size: "2MB", type: "pdf" },
  { name: "Joining Report.pdf", size: "1.5MB", type: "pdf" },
  { name: "NMC Certificate.jpg", size: "3MB", type: "image" },
];

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium uppercase text-gray-500">
        {label}
      </label>
      <p className="border-b border-dark-border pb-2 text-sm font-medium text-gray-200">
        {value}
      </p>
    </div>
  );
}

export function PersonalTab() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Left Column — 2/3 */}
      <div className="space-y-6 lg:col-span-2">
        {/* Basic Information */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <User className="h-5 w-5 text-emerald-500" />
              Basic Information
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <InfoField label="Full Name" value={BASIC_INFO.fullName} />
              <InfoField label="Date of Birth" value={BASIC_INFO.dob} />
              <InfoField label="Gender" value={BASIC_INFO.gender} />
              <InfoField
                label="Marital Status"
                value={BASIC_INFO.maritalStatus}
              />
              <InfoField
                label="Father's Name"
                value={BASIC_INFO.fatherName}
              />
              <InfoField label="Nationality" value={BASIC_INFO.nationality} />
              <div className="md:col-span-2">
                <InfoField
                  label="Residential Address"
                  value={BASIC_INFO.address}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Details */}
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Briefcase className="h-5 w-5 text-emerald-500" />
              Service Details
            </h3>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <InfoField
                label="Date of Joining (Current)"
                value={SERVICE_DETAILS.dateOfJoining}
              />
              <InfoField
                label="Designation at Joining"
                value={SERVICE_DETAILS.designationAtJoining}
              />
              <InfoField
                label="Current Employment Type"
                value={SERVICE_DETAILS.employmentType}
              />
              <div className="space-y-1">
                <label className="text-xs font-medium uppercase text-gray-500">
                  Date of Retirement
                </label>
                <div className="flex items-center justify-between border-b border-dark-border pb-2">
                  <p className="text-sm font-medium text-gray-200">
                    {SERVICE_DETAILS.retirementDate}
                  </p>
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">
                    {SERVICE_DETAILS.retirementCountdown}
                  </span>
                </div>
              </div>
              <InfoField
                label="Last Promotion Date"
                value={SERVICE_DETAILS.lastPromotionDate}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column — 1/3 */}
      <div className="space-y-6 lg:col-span-1">
        {/* Registration IDs */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-5">
            <h3 className="mb-4 text-base font-bold text-white">
              Registration IDs
            </h3>
            <div className="space-y-4">
              {REGISTRATION_IDS.map((reg) => (
                <div
                  key={reg.label}
                  className="cursor-pointer rounded-lg border border-dark-border bg-[#262626]/50 p-3 transition-colors hover:border-emerald-500/50"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">
                      {reg.label}
                    </span>
                    {reg.verified ? (
                      <CheckCircle className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Lock className="h-4 w-4 text-gray-600" />
                    )}
                  </div>
                  <div className="font-mono text-sm tracking-wide text-white">
                    {reg.value}
                  </div>
                  {reg.subLabel && (
                    <div className="mt-1 text-[10px] text-gray-500">
                      {reg.subLabel}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card>
          <CardContent className="p-5">
            <h3 className="mb-4 text-base font-bold text-white">
              Emergency Contact
            </h3>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-xs font-bold text-pink-400">
                {EMERGENCY_CONTACT.initials}
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {EMERGENCY_CONTACT.name}
                </p>
                <p className="text-xs text-gray-500">
                  {EMERGENCY_CONTACT.relation}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-6 text-xs">
                    <Phone className="mr-1 h-3 w-3" /> Call
                  </Button>
                  <span className="text-xs text-gray-500">
                    {EMERGENCY_CONTACT.phone}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Documents</h3>
              <button className="text-xs font-medium text-emerald-500 hover:underline">
                View All
              </button>
            </div>
            <ul className="space-y-3">
              {DOCUMENTS.map((doc) => (
                <li
                  key={doc.name}
                  className="group flex cursor-pointer items-center gap-3 text-sm text-gray-400 transition-colors hover:text-white"
                >
                  {doc.type === "pdf" ? (
                    <FileText className="h-5 w-5 text-red-400" />
                  ) : (
                    <Image className="h-5 w-5 text-blue-400" />
                  )}
                  <span className="flex-1 group-hover:underline">
                    {doc.name}
                  </span>
                  <span className="text-xs text-gray-600">{doc.size}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

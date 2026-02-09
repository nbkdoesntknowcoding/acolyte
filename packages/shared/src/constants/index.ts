/** NMC CBME subjects */
export const NMC_SUBJECTS = [
  'Anatomy',
  'Physiology',
  'Biochemistry',
  'Pathology',
  'Microbiology',
  'Pharmacology',
  'Forensic Medicine',
  'Community Medicine',
  'General Medicine',
  'General Surgery',
  'Obstetrics & Gynaecology',
  'Paediatrics',
  'Ophthalmology',
  'ENT',
  'Orthopaedics',
  'Dermatology',
  'Psychiatry',
  'Anaesthesia',
  'Radiology',
] as const;

export type NMCSubject = (typeof NMC_SUBJECTS)[number];

/** NMC intake sizes for MSR calculation */
export const NMC_INTAKE_SIZES = [100, 150, 200, 250] as const;

/** Faculty designation hierarchy */
export const FACULTY_DESIGNATIONS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Tutor/Demonstrator',
  'Senior Resident',
] as const;

/** Admission quotas */
export const ADMISSION_QUOTAS = [
  'AIQ',
  'State',
  'Management',
  'NRI',
  'Institutional',
] as const;

/** Assessment statuses */
export const ASSESSMENT_STATUSES = [
  'draft',
  'peer_reviewed',
  'approved',
  'active',
  'conducted',
  'analyzed',
  'retired',
] as const;

/** SAF form types */
export const SAF_FORM_TYPES = ['AI', 'AII', 'AIII'] as const;

/** AETCOM module count */
export const AETCOM_MODULE_COUNT = 27;

/** Max competency count per NMC CBME */
export const TOTAL_COMPETENCIES_APPROX = 3500;

/** API rate limits */
export const RATE_LIMITS = {
  PER_HOUR: 1000,
  PER_MINUTE: 100,
} as const;

/** AI confidence thresholds */
export const AI_CONFIDENCE = {
  AUTO_APPROVE: 0.95,
  NEEDS_REVIEW: 0.80,
} as const;

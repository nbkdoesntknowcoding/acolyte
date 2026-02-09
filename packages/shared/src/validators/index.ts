import { z } from 'zod';

/** UUID v4 validation */
export const uuidSchema = z.string().uuid();

/** Pagination query params */
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

/** Date range filter */
export const dateRangeSchema = z.object({
  start_date: z.string().date(),
  end_date: z.string().date(),
});

/** NMC competency code format: "XX 1.2" */
export const competencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{2}\s\d+\.\d+$/, 'Invalid NMC competency code format (e.g., "PH 1.5")');

/** Academic year format: "2025-26" */
export const academicYearSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'Invalid academic year format (e.g., "2025-26")');

/** Indian phone number */
export const indianPhoneSchema = z
  .string()
  .regex(/^(\+91)?[6-9]\d{9}$/, 'Invalid Indian phone number');

/** Email validation */
export const emailSchema = z.string().email();

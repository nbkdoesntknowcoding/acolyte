# PASTE THIS ENTIRE BLOCK INTO CLAUDE CODE

Read the file `CLAUDE_CODE_ADMIN_ENGINE_BACKEND.md` in the repo root. It contains the complete specification for the Admin Engine backend. Execute it in this exact order:

## Step 1: Models
Create `backend/app/engines/admin/models.py` with ALL 28 model classes defined in the spec (College through AuditLog). Every tenant-scoped model must extend `TenantModel` from `backend/app/shared/models.py`. Store all money as BigInteger in paisa. Use JSONB for flexible config fields. Add proper indexes on (college_id), (college_id, student_id), (college_id, faculty_id), (college_id, department_id).

## Step 2: Migration
Run `alembic revision --autogenerate -m "admin_engine_complete_schema"`. Review the generated migration. Add RLS policies for every tenant-scoped table. Apply with `alembic upgrade head`.

## Step 3: Schemas  
Create `backend/app/engines/admin/schemas.py` with Pydantic v2 schemas. Every model needs: `{Model}Create`, `{Model}Update`, `{Model}Response`, `{Model}ListResponse` (with pagination: items, total, page, page_size). Create schemas omit id/college_id/timestamps. Update schemas make all fields Optional. Validate Indian phone numbers (10 digits starting 6-9), NEET scores (0-720), and all enum fields.

## Step 4: Services
Create these service files under `backend/app/engines/admin/services/`:

- `fee_calculator.py` — calculate_total_fee, calculate_outstanding, calculate_late_fee, generate_installment_schedule, check_fee_regulatory_compliance
- `msr_checker.py` — get_msr_requirements (by intake 100/150/200/250), calculate_department_compliance (actual vs required per designation), get_overall_compliance_score, forecast_retirement_impact, get_critical_gaps
- `payroll_processor.py` — calculate_salary (basic + DA 55% + HRA + NPA 20% + transport), calculate_epf (12%+12%), calculate_esi (0.75%+3.25% if ≤₹21K), calculate_tds (slab-based), calculate_professional_tax (state-specific), generate_bank_file (NEFT format)
- `scholarship_matcher.py` — match_student_to_schemes (compare category/income/merit/state against scheme eligibility), auto_match_all_students, check_renewal_eligibility
- `certificate_generator.py` — generate_certificate (PDF with college header + QR code), verify_certificate (public endpoint, no auth)
- `dashboard_aggregator.py` — get_dashboard_stats, get_fee_collection_trend, get_recent_activity, get_pending_approvals
- `receipt_generator.py` — generate_fee_receipt (PDF with receipt number + QR + digital signature)

## Step 5: Routes
Create route files under `backend/app/engines/admin/routes/`. Every route file uses `APIRouter` with proper prefix and tags. Every list endpoint supports: search, sort_by, sort_order, page, page_size, plus entity-specific filters.

Create these route files with ALL endpoints from the spec:
- `dashboard.py` — 5 GET endpoints (stats, fee-trend, pending-approvals, recent-activity, compliance-summary)
- `students.py` — standard CRUD + bulk-import, verify-document, promote, fee-summary, attendance-summary, nmc-upload, seat-matrix
- `admissions.py` — pipeline, counseling-rounds, bulk-verify
- `fees.py` — CRUD for fee_structures + record-payment, generate-receipt, defaulters, send-reminder, collection-summary, calculate-late-fee
- `scholarships.py` — CRUD for schemes + student_scholarships + auto-match, matched/{student_id}, update-status, disbursement-summary
- `faculty.py` — CRUD + msr-compliance, retirement-forecast, portfolio, bulk-import, validate-nmc
- `payroll.py` — CRUD for payroll_records + salary_structures + calculate, approve, generate-bank-file, generate-payslips, email-payslips, statutory-summary
- `leave.py` — CRUD for leave_requests + leave_policies + leave_balances + approve, reject, calendar, balance/{employee_id}, department-impact
- `recruitment.py` — CRUD for positions + candidates with pipeline stage management
- `certificates.py` — CRUD + generate, verify/{cert_number} (PUBLIC, no auth), revoke
- `alumni.py` — standard CRUD with filters on graduation_year, specialization, location, employment_type
- `hostel.py` — CRUD for blocks + rooms + allocations + mess_units + occupancy, allocate, auto-allocate, transfer, nmc-compliance
- `transport.py` — CRUD for vehicles + routes + bookings + maintenance_logs
- `library.py` — CRUD for books + journals + issuances + nmc-compliance, issue-book, return-book, overdue
- `infrastructure.py` — CRUD for infrastructure + equipment + maintenance_tickets
- `notices.py` — CRUD + publish, analytics, bulk-send + CRUD for read_receipts
- `grievances.py` — CRUD for committees + committee_members + grievances with timeline tracking
- `workflows.py` — CRUD for definitions + instances + pending, approve, reject, stats
- `documents.py` — CRUD with version control (parent_document_id), category filtering, tag search
- `calendar.py` — CRUD for academic_calendar_events with phase/department filtering
- `timetable.py` — CRUD for timetable_slots with conflict detection (no double-booking rooms or faculty)
- `rotations.py` — CRUD for clinical_rotations + generate (constraint solver), matrix (Gantt data), validate-nmc
- `executive.py` — financial-overview, compliance-heatmap, academic-performance, action-items
- `settings.py` — college-profile GET/PUT, audit-log query with filters

Register ALL routers in `backend/app/engines/admin/routes/__init__.py` and include in `main.py`.

## Step 6: Utils
Create `backend/app/engines/admin/utils/`:
- `indian_currency.py` — `format_inr(paisa: int) -> str` converts 1423560000 to "₹14,23,56,000", `paisa_to_rupees(paisa: int) -> float`, `format_inr_short(paisa: int) -> str` converts to "₹14.2 Cr"
- `validators.py` — validate_indian_phone, validate_neet_score, hash_aadhaar (SHA-256), generate_receipt_number, generate_certificate_number, generate_ticket_number

## Step 7: Seed Data
Create `backend/scripts/seed_admin.py` that seeds:
1. 19 NMC departments with correct names, codes, and types (pre_clinical/para_clinical/clinical)
2. MSR requirements per intake size (100: 85 faculty + 65 tutors, 150: 122+82, 250: 168+105) broken down by department and designation
3. 15+ real scholarship schemes (Central Sector ₹10-20K/yr, Post-Matric SC/ST, PM-YASASVI ₹60K/yr, Top Class SC, PMSS ₹3-3.25K/month, PMSSS ₹3L/yr, ONGC Foundation ₹48K/yr, ICMR STS, etc.)
4. Leave policies for 3 staff categories (teaching: CL 8, EL 30; hospital: CL 12, EL 30; admin: CL 12, EL 30; plus maternity 180 days, study leave up to 2 years)
5. Salary structures for 7th CPC levels 10-15 with current DA 55%, HRA 24%, NPA 20%
6. Default workflow definitions (leave: HOD→Dean, certificate: admin→Dean, purchase: HOD→Finance→Dean)
7. One sample college (Karnataka, 150-seat private, affiliated to RGUHS)
8. 20 sample students across quotas and phases
9. 15 sample faculty across departments and designations
10. Sample fee structures for AIQ, State, Management, NRI quotas with realistic amounts

Run the seed script after migration.

## Step 8: Wire to Frontend
Create `backend/app/engines/admin/__init__.py` exposing the public interface — all router objects and key service functions that other engines may call (like get_student, get_faculty, get_department).

## Critical Rules
- Multi-tenant: EVERY query filters by college_id. RLS is safety net, app code also filters explicitly.
- Async only: `async def` everywhere, SQLAlchemy async sessions with `asyncpg`.
- Money in paisa: BigInteger, 1 rupee = 100 paisa. Frontend formats for display.
- No AI: This is pure CRUD + computation. AI Engine is separate.
- Audit trail: Every create/update/delete writes to audit_log table.
- Soft delete: Use status fields, not DELETE, for students/faculty/important records.
- Indian context: Phone validation (6-9 start, 10 digits), Aadhaar as SHA-256 hash only, Indian states, IST timezone.
- Pagination: Default page_size=25 on all list endpoints.
- Error handling: Use FastAPI HTTPException with proper status codes (400 validation, 404 not found, 403 forbidden, 409 conflict).

Do NOT ask questions. Execute all 8 steps sequentially. If any step fails, fix it before moving to the next.

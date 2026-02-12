"""admin_engine_schema

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-02-12 10:00:00.000000

Admin Engine expansion:
- Adds new columns to 8 existing tables (colleges, departments, batches,
  students, faculty, fee_structures, fee_payments, clinical_rotations)
- Creates 38 new tables for SIS, HR/payroll, hostel, transport, library,
  infrastructure, notices, grievances, workflows, documents, calendar,
  timetable, scholarships, certificates, alumni, recruitment
- Adds RLS policies on all new tenant-scoped tables
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# New tenant-scoped tables that need RLS
ADMIN_TENANT_TABLES = [
    "student_documents",
    "faculty_qualifications",
    "fee_refunds",
    "student_scholarships",
    "payroll_records",
    "salary_structures",
    "leave_policies",
    "leave_requests",
    "leave_balances",
    "recruitment_positions",
    "recruitment_candidates",
    "certificates",
    "alumni",
    "hostel_blocks",
    "hostel_rooms",
    "hostel_allocations",
    "mess_units",
    "vehicles",
    "transport_routes",
    "transport_bookings",
    "vehicle_maintenance_logs",
    "library_books",
    "library_journals",
    "library_issuances",
    "infrastructure",
    "equipment",
    "maintenance_tickets",
    "notices",
    "notice_read_receipts",
    "committees",
    "committee_members",
    "grievances",
    "workflow_definitions",
    "workflow_instances",
    "documents",
    "academic_calendar_events",
    "timetable_slots",
]


def upgrade() -> None:
    # ==================================================================
    # PART 1: Add new columns to existing tables
    # ==================================================================

    # --- 1a. colleges ---
    op.add_column('colleges', sa.Column('nmc_registration_number', sa.String(50), nullable=True))
    op.add_column('colleges', sa.Column('address', sa.Text(), nullable=True))
    op.add_column('colleges', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('colleges', sa.Column('pin_code', sa.String(10), nullable=True))
    op.add_column('colleges', sa.Column('phone', sa.String(20), nullable=True))
    op.add_column('colleges', sa.Column('email', sa.String(255), nullable=True))
    op.add_column('colleges', sa.Column('website', sa.String(500), nullable=True))
    op.add_column('colleges', sa.Column('established_year', sa.Integer(), nullable=True))
    op.add_column('colleges', sa.Column('college_type', sa.String(30), nullable=True))
    op.add_column('colleges', sa.Column('sanctioned_intake', sa.Integer(), nullable=True))
    op.add_column('colleges', sa.Column('logo_url', sa.String(500), nullable=True))
    op.add_column('colleges', sa.Column('status', sa.String(20), server_default='active', nullable=True))
    op.create_unique_constraint('uq_colleges_nmc_reg', 'colleges', ['nmc_registration_number'])

    # --- 1b. departments (beds, opd_rooms, labs, lecture_halls, etc.) ---
    op.add_column('departments', sa.Column('department_type', sa.String(30), nullable=True))
    op.add_column('departments', sa.Column('beds', sa.Integer(), server_default='0', nullable=True))
    op.add_column('departments', sa.Column('opd_rooms', sa.Integer(), server_default='0', nullable=True))
    op.add_column('departments', sa.Column('labs', sa.Integer(), server_default='0', nullable=True))
    op.add_column('departments', sa.Column('lecture_halls', sa.Integer(), server_default='0', nullable=True))
    op.add_column('departments', sa.Column('nmc_department_code', sa.String(20), nullable=True))
    op.add_column('departments', sa.Column('display_order', sa.Integer(), server_default='0', nullable=True))
    op.create_index('ix_dept_college_active', 'departments', ['college_id', 'is_active'])

    # --- 1c. batches ---
    op.add_column('batches', sa.Column('batch_type', sa.String(20), nullable=True))
    op.add_column('batches', sa.Column('current_phase', sa.String(20), nullable=True))
    op.add_column('batches', sa.Column('current_semester', sa.Integer(), nullable=True))
    op.add_column('batches', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True))

    # --- 1d. students (many new columns) ---
    op.add_column('students', sa.Column('blood_group', sa.String(10), nullable=True))
    op.add_column('students', sa.Column('nationality', sa.String(50), server_default='Indian', nullable=True))
    op.add_column('students', sa.Column('religion', sa.String(50), nullable=True))
    op.add_column('students', sa.Column('category', sa.String(20), nullable=True))
    op.add_column('students', sa.Column('photo_url', sa.String(500), nullable=True))
    op.add_column('students', sa.Column('father_name', sa.String(255), nullable=True))
    op.add_column('students', sa.Column('mother_name', sa.String(255), nullable=True))
    op.add_column('students', sa.Column('guardian_phone', sa.String(20), nullable=True))
    op.add_column('students', sa.Column('guardian_email', sa.String(255), nullable=True))
    op.add_column('students', sa.Column('emergency_contact_name', sa.String(255), nullable=True))
    op.add_column('students', sa.Column('emergency_contact_phone', sa.String(20), nullable=True))
    op.add_column('students', sa.Column('permanent_address', sa.Text(), nullable=True))
    op.add_column('students', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('students', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('students', sa.Column('pin_code', sa.String(10), nullable=True))
    op.add_column('students', sa.Column('neet_year', sa.Integer(), nullable=True))
    op.add_column('students', sa.Column('counseling_round', sa.String(30), nullable=True))
    op.add_column('students', sa.Column('allotment_order_number', sa.String(100), nullable=True))
    op.add_column('students', sa.Column('admission_date', sa.Date(), nullable=True))
    op.add_column('students', sa.Column('class_10_board', sa.String(100), nullable=True))
    op.add_column('students', sa.Column('class_10_percentage', sa.Float(), nullable=True))
    op.add_column('students', sa.Column('class_12_board', sa.String(100), nullable=True))
    op.add_column('students', sa.Column('class_12_percentage', sa.Float(), nullable=True))
    op.add_column('students', sa.Column('pcb_percentage', sa.Float(), nullable=True))
    op.add_column('students', sa.Column('gap_years', sa.Integer(), server_default='0', nullable=True))
    op.add_column('students', sa.Column('batch_id', sa.UUID(), nullable=True))
    op.add_column('students', sa.Column('is_hosteler', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('students', sa.Column('nmc_uploaded', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('students', sa.Column('nmc_upload_date', sa.DateTime(timezone=True), nullable=True))
    # current_phase: widen from String(10) to String(20)
    op.alter_column('students', 'current_phase',
                    existing_type=sa.String(10), type_=sa.String(20))
    op.create_foreign_key('fk_students_batch_id', 'students', 'batches', ['batch_id'], ['id'])
    # hostel_room_id FK added after hostel_rooms table is created (below)
    op.create_index('ix_student_college_status', 'students', ['college_id', 'status'])
    op.create_index('ix_student_college_batch', 'students', ['college_id', 'batch_id'])
    op.create_index('ix_student_college_phase', 'students', ['college_id', 'current_phase'])

    # --- 1e. faculty ---
    op.add_column('faculty', sa.Column('gender', sa.String(20), nullable=True))
    op.add_column('faculty', sa.Column('photo_url', sa.String(500), nullable=True))
    op.add_column('faculty', sa.Column('aadhaar_hash', sa.String(64), nullable=True))
    op.add_column('faculty', sa.Column('pan_number_hash', sa.String(64), nullable=True))
    op.add_column('faculty', sa.Column('permanent_address', sa.Text(), nullable=True))
    op.add_column('faculty', sa.Column('city', sa.String(100), nullable=True))
    op.add_column('faculty', sa.Column('state', sa.String(100), nullable=True))
    op.add_column('faculty', sa.Column('pin_code', sa.String(10), nullable=True))
    op.add_column('faculty', sa.Column('sub_specialization', sa.String(100), nullable=True))
    op.add_column('faculty', sa.Column('employee_id', sa.String(50), nullable=True))
    op.add_column('faculty', sa.Column('pay_scale_type', sa.String(20), nullable=True))
    op.add_column('faculty', sa.Column('total_experience_years', sa.Float(), nullable=True))
    op.add_column('faculty', sa.Column('orcid_id', sa.String(50), nullable=True))
    op.add_column('faculty', sa.Column('publications_count', sa.Integer(), server_default='0', nullable=True))
    op.add_column('faculty', sa.Column('h_index', sa.Integer(), server_default='0', nullable=True))
    op.add_column('faculty', sa.Column('bcme_completed', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('faculty', sa.Column('bank_account_number_hash', sa.String(64), nullable=True))
    op.add_column('faculty', sa.Column('bank_ifsc', sa.String(20), nullable=True))
    op.add_column('faculty', sa.Column('bank_name', sa.String(100), nullable=True))
    op.create_index('ix_faculty_college_dept', 'faculty', ['college_id', 'department_id'])
    op.create_index('ix_faculty_college_status', 'faculty', ['college_id', 'status'])

    # --- 1f. fee_structures ---
    op.add_column('fee_structures', sa.Column('hostel_fee_boys', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('hostel_fee_girls', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('examination_fee', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('laboratory_fee', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('university_registration_fee', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('insurance_premium', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('identity_card_fee', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('other_fees', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('other_fees_description', sa.Text(), nullable=True))
    op.add_column('fee_structures', sa.Column('approval_date', sa.Date(), nullable=True))
    op.add_column('fee_structures', sa.Column('approval_document_url', sa.String(500), nullable=True))
    op.add_column('fee_structures', sa.Column('installment_config', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('fee_structures', sa.Column('late_fee_per_day', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_structures', sa.Column('grace_period_days', sa.Integer(), server_default='15', nullable=True))
    op.add_column('fee_structures', sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True))
    op.create_index('ix_feestruct_college_year_quota', 'fee_structures',
                    ['college_id', 'academic_year', 'quota'])

    # --- 1g. fee_payments ---
    op.add_column('fee_payments', sa.Column('academic_year', sa.String(10), nullable=True))
    op.add_column('fee_payments', sa.Column('razorpay_signature', sa.String(255), nullable=True))
    op.add_column('fee_payments', sa.Column('reference_number', sa.String(100), nullable=True))
    op.add_column('fee_payments', sa.Column('bank_name', sa.String(100), nullable=True))
    op.add_column('fee_payments', sa.Column('payment_date', sa.Date(), nullable=True))
    op.add_column('fee_payments', sa.Column('fee_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('fee_payments', sa.Column('late_fee_amount', sa.BigInteger(), server_default='0', nullable=True))
    op.add_column('fee_payments', sa.Column('late_fee_days', sa.Integer(), server_default='0', nullable=True))
    op.add_column('fee_payments', sa.Column('recorded_by', sa.UUID(), nullable=True))
    op.add_column('fee_payments', sa.Column('notes', sa.Text(), nullable=True))
    op.create_index('ix_feepay_college_student', 'fee_payments', ['college_id', 'student_id'])
    op.create_index('ix_feepay_college_status', 'fee_payments', ['college_id', 'status'])

    # --- 1h. clinical_rotations ---
    op.add_column('clinical_rotations', sa.Column('rotation_group', sa.String(20), nullable=True))
    op.add_column('clinical_rotations', sa.Column('phase', sa.String(20), nullable=True))
    op.add_column('clinical_rotations', sa.Column('supervisor_faculty_id', sa.UUID(), nullable=True))
    op.add_column('clinical_rotations', sa.Column('attendance_percentage', sa.Float(), nullable=True))
    op.add_column('clinical_rotations', sa.Column('is_crmi', sa.Boolean(), server_default='false', nullable=True))
    op.add_column('clinical_rotations', sa.Column('crmi_leave_days_taken', sa.Integer(), server_default='0', nullable=True))
    op.create_foreign_key('fk_clinrot_supervisor', 'clinical_rotations', 'faculty',
                          ['supervisor_faculty_id'], ['id'])
    op.create_index('ix_clinrot_college_student', 'clinical_rotations', ['college_id', 'student_id'])
    op.create_index('ix_clinrot_college_dept', 'clinical_rotations', ['college_id', 'department_id'])

    # ==================================================================
    # PART 2: Create new non-tenant reference table
    # ==================================================================

    op.create_table('scholarship_schemes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('awarding_body', sa.String(100), nullable=True),
        sa.Column('scheme_code', sa.String(50), nullable=True),
        sa.Column('eligible_categories', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('income_ceiling', sa.BigInteger(), nullable=True),
        sa.Column('merit_criteria', sa.Text(), nullable=True),
        sa.Column('eligible_states', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('amount_per_year', sa.BigInteger(), nullable=True),
        sa.Column('amount_description', sa.Text(), nullable=True),
        sa.Column('covers_components', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('application_portal', sa.String(100), nullable=True),
        sa.Column('portal_url', sa.String(500), nullable=True),
        sa.Column('application_window_start', sa.Date(), nullable=True),
        sa.Column('application_window_end', sa.Date(), nullable=True),
        sa.Column('renewal_required', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('renewal_criteria', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('academic_year', sa.String(10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )

    # ==================================================================
    # PART 3: Create new tenant-scoped tables (dependency order)
    # ==================================================================

    # --- 3.01 leave_policies ---
    op.create_table('leave_policies',
        sa.Column('staff_category', sa.String(30), nullable=False),
        sa.Column('leave_type', sa.String(30), nullable=False),
        sa.Column('annual_entitlement', sa.Integer(), nullable=True),
        sa.Column('max_accumulation', sa.Integer(), nullable=True),
        sa.Column('can_carry_forward', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('requires_document', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('min_service_for_eligibility', sa.Integer(), server_default='0', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_leave_policies_college_id'), 'leave_policies', ['college_id'])

    # --- 3.02 salary_structures ---
    op.create_table('salary_structures',
        sa.Column('designation', sa.String(50), nullable=False),
        sa.Column('pay_scale_type', sa.String(20), nullable=False),
        sa.Column('pay_level', sa.Integer(), nullable=True),
        sa.Column('pay_band_min', sa.BigInteger(), nullable=True),
        sa.Column('pay_band_max', sa.BigInteger(), nullable=True),
        sa.Column('basic_pay', sa.BigInteger(), nullable=True),
        sa.Column('da_percentage', sa.Float(), server_default='55.0', nullable=True),
        sa.Column('hra_percentage', sa.Float(), server_default='24.0', nullable=True),
        sa.Column('npa_percentage', sa.Float(), server_default='20.0', nullable=True),
        sa.Column('transport_allowance', sa.BigInteger(), server_default='360000', nullable=True),
        sa.Column('epf_employee_percentage', sa.Float(), server_default='12.0', nullable=True),
        sa.Column('epf_employer_percentage', sa.Float(), server_default='12.0', nullable=True),
        sa.Column('esi_employee_percentage', sa.Float(), server_default='0.75', nullable=True),
        sa.Column('esi_employer_percentage', sa.Float(), server_default='3.25', nullable=True),
        sa.Column('esi_salary_ceiling', sa.BigInteger(), server_default='2100000', nullable=True),
        sa.Column('professional_tax_slab', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_salary_structures_college_id'), 'salary_structures', ['college_id'])

    # --- 3.03 mess_units ---
    op.create_table('mess_units',
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('mess_type', sa.String(20), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('vendor_name', sa.String(255), nullable=True),
        sa.Column('vendor_contact', sa.String(20), nullable=True),
        sa.Column('monthly_fee', sa.BigInteger(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_mess_units_college_id'), 'mess_units', ['college_id'])

    # --- 3.04 workflow_definitions ---
    op.create_table('workflow_definitions',
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('workflow_type', sa.String(30), nullable=False),
        sa.Column('approval_chain', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_workflow_definitions_college_id'), 'workflow_definitions', ['college_id'])

    # --- 3.05 notices ---
    op.create_table('notices',
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('notice_type', sa.String(20), nullable=True),
        sa.Column('priority', sa.String(20), server_default='normal', nullable=True),
        sa.Column('target_audience', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('posted_by', sa.UUID(), nullable=True),
        sa.Column('posted_by_name', sa.String(255), nullable=True),
        sa.Column('delivery_channels', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('requires_acknowledgment', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_pinned', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('attachments', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(20), server_default='draft', nullable=True),
        sa.Column('read_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('total_recipients', sa.Integer(), server_default='0', nullable=True),
        sa.Column('acknowledged_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notices_college_id'), 'notices', ['college_id'])
    op.create_index('ix_notice_college_status', 'notices', ['college_id', 'status'])

    # --- 3.06 committees ---
    op.create_table('committees',
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('committee_type', sa.String(30), nullable=True),
        sa.Column('is_nmc_mandated', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('chairperson_name', sa.String(255), nullable=True),
        sa.Column('chairperson_contact', sa.String(100), nullable=True),
        sa.Column('meeting_frequency', sa.String(50), nullable=True),
        sa.Column('last_meeting_date', sa.Date(), nullable=True),
        sa.Column('next_meeting_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), server_default='active', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_committees_college_id'), 'committees', ['college_id'])

    # --- 3.07 vehicles ---
    op.create_table('vehicles',
        sa.Column('vehicle_number', sa.String(20), nullable=False),
        sa.Column('vehicle_type', sa.String(20), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('make_model', sa.String(100), nullable=True),
        sa.Column('year_of_purchase', sa.Integer(), nullable=True),
        sa.Column('driver_name', sa.String(255), nullable=True),
        sa.Column('driver_phone', sa.String(20), nullable=True),
        sa.Column('driver_license_number', sa.String(50), nullable=True),
        sa.Column('insurance_expiry', sa.Date(), nullable=True),
        sa.Column('fitness_certificate_expiry', sa.Date(), nullable=True),
        sa.Column('last_service_date', sa.Date(), nullable=True),
        sa.Column('next_service_due', sa.Date(), nullable=True),
        sa.Column('current_km_reading', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), server_default='active', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vehicles_college_id'), 'vehicles', ['college_id'])

    # --- 3.08 hostel_blocks ---
    op.create_table('hostel_blocks',
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('block_type', sa.String(30), nullable=True),
        sa.Column('total_rooms', sa.Integer(), server_default='0', nullable=True),
        sa.Column('total_beds', sa.Integer(), server_default='0', nullable=True),
        sa.Column('floors', sa.Integer(), server_default='1', nullable=True),
        sa.Column('warden_faculty_id', sa.UUID(), nullable=True),
        sa.Column('warden_phone', sa.String(20), nullable=True),
        sa.Column('has_cctv', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('is_anti_ragging_compliant', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['warden_faculty_id'], ['faculty.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_hostel_blocks_college_id'), 'hostel_blocks', ['college_id'])

    # --- 3.09 hostel_rooms ---
    op.create_table('hostel_rooms',
        sa.Column('block_id', sa.UUID(), nullable=False),
        sa.Column('room_number', sa.String(20), nullable=False),
        sa.Column('floor', sa.Integer(), server_default='0', nullable=True),
        sa.Column('capacity', sa.Integer(), server_default='2', nullable=True),
        sa.Column('current_occupancy', sa.Integer(), server_default='0', nullable=True),
        sa.Column('room_type', sa.String(20), server_default='regular', nullable=True),
        sa.Column('has_ac', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('has_attached_bathroom', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('status', sa.String(20), server_default='available', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['block_id'], ['hostel_blocks.id']),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_hostel_rooms_college_id'), 'hostel_rooms', ['college_id'])
    op.create_index('ix_hostelroom_college_block', 'hostel_rooms', ['college_id', 'block_id'])

    # Now add hostel_room_id FK to students (deferred because hostel_rooms must exist)
    op.add_column('students', sa.Column('hostel_room_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_students_hostel_room', 'students', 'hostel_rooms',
                          ['hostel_room_id'], ['id'], use_alter=True)

    # --- 3.10 transport_routes ---
    op.create_table('transport_routes',
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('route_type', sa.String(30), nullable=True),
        sa.Column('origin', sa.String(255), nullable=True),
        sa.Column('destination', sa.String(255), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('schedule', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('vehicle_id', sa.UUID(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_transport_routes_college_id'), 'transport_routes', ['college_id'])

    # --- 3.11 infrastructure ---
    op.create_table('infrastructure',
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('category', sa.String(30), nullable=True),
        sa.Column('building', sa.String(100), nullable=True),
        sa.Column('floor', sa.Integer(), nullable=True),
        sa.Column('room_number', sa.String(20), nullable=True),
        sa.Column('area_sqm', sa.Float(), nullable=True),
        sa.Column('capacity', sa.Integer(), nullable=True),
        sa.Column('department_id', sa.UUID(), nullable=True),
        sa.Column('has_ac', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('has_projector', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('has_smart_board', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('condition', sa.String(20), server_default='good', nullable=True),
        sa.Column('last_inspection_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_infrastructure_college_id'), 'infrastructure', ['college_id'])
    op.create_index('ix_infra_college_dept', 'infrastructure', ['college_id', 'department_id'])

    # --- 3.12 student_documents ---
    op.create_table('student_documents',
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('document_type', sa.String(50), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('is_required', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('verification_status', sa.String(20), server_default='not_uploaded', nullable=True),
        sa.Column('verified_by', sa.UUID(), nullable=True),
        sa.Column('verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('ocr_extracted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_student_documents_college_id'), 'student_documents', ['college_id'])
    op.create_index('ix_studdoc_college_student', 'student_documents', ['college_id', 'student_id'])

    # --- 3.13 faculty_qualifications ---
    op.create_table('faculty_qualifications',
        sa.Column('faculty_id', sa.UUID(), nullable=False),
        sa.Column('degree', sa.String(50), nullable=False),
        sa.Column('specialization', sa.String(100), nullable=True),
        sa.Column('university', sa.String(255), nullable=True),
        sa.Column('year_of_passing', sa.Integer(), nullable=True),
        sa.Column('certificate_url', sa.String(500), nullable=True),
        sa.Column('nmc_verified', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('hospital_bed_count', sa.Integer(), nullable=True),
        sa.Column('is_highest', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['faculty_id'], ['faculty.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_faculty_qualifications_college_id'), 'faculty_qualifications', ['college_id'])
    op.create_index('ix_facqual_college_faculty', 'faculty_qualifications', ['college_id', 'faculty_id'])

    # --- 3.14 fee_refunds ---
    op.create_table('fee_refunds',
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('original_payment_id', sa.UUID(), nullable=True),
        sa.Column('reason', sa.String(50), nullable=True),
        sa.Column('original_amount_paid', sa.BigInteger(), nullable=False),
        sa.Column('refund_amount', sa.BigInteger(), nullable=False),
        sa.Column('deductions', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('deduction_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('bank_account_number_last4', sa.String(4), nullable=True),
        sa.Column('bank_ifsc', sa.String(20), nullable=True),
        sa.Column('bank_name', sa.String(100), nullable=True),
        sa.Column('account_holder_name', sa.String(255), nullable=True),
        sa.Column('status', sa.String(20), server_default='requested', nullable=True),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('neft_reference', sa.String(100), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('expected_completion_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['original_payment_id'], ['fee_payments.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_fee_refunds_college_id'), 'fee_refunds', ['college_id'])
    op.create_index('ix_feerefund_college_student', 'fee_refunds', ['college_id', 'student_id'])

    # --- 3.15 student_scholarships ---
    op.create_table('student_scholarships',
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('scheme_id', sa.UUID(), nullable=False),
        sa.Column('academic_year', sa.String(10), nullable=True),
        sa.Column('application_status', sa.String(20), server_default='matched', nullable=True),
        sa.Column('application_id', sa.String(100), nullable=True),
        sa.Column('application_date', sa.Date(), nullable=True),
        sa.Column('sanctioned_amount', sa.BigInteger(), nullable=True),
        sa.Column('disbursed_amount', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('disbursement_date', sa.Date(), nullable=True),
        sa.Column('dbt_status', sa.String(20), nullable=True),
        sa.Column('aadhaar_seeded', sa.Boolean(), nullable=True),
        sa.Column('l1_verified_by', sa.UUID(), nullable=True),
        sa.Column('l1_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['scheme_id'], ['scholarship_schemes.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_student_scholarships_college_id'), 'student_scholarships', ['college_id'])
    op.create_index('ix_studschol_college_student', 'student_scholarships', ['college_id', 'student_id'])
    op.create_index('ix_studschol_college_status', 'student_scholarships', ['college_id', 'application_status'])

    # --- 3.16 payroll_records ---
    op.create_table('payroll_records',
        sa.Column('faculty_id', sa.UUID(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('basic_pay', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('dearness_allowance', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('house_rent_allowance', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('non_practicing_allowance', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('transport_allowance', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('special_allowance', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('other_allowances', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('other_allowances_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('gross_earnings', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('epf_employee', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('epf_employer', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('esi_employee', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('esi_employer', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('tds', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('professional_tax', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('other_deductions', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('other_deductions_breakdown', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('total_deductions', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('net_pay', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('status', sa.String(20), server_default='draft', nullable=True),
        sa.Column('calculated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('approved_by', sa.UUID(), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('disbursed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('bank_file_generated', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('pay_slip_url', sa.String(500), nullable=True),
        sa.Column('pay_slip_emailed', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['faculty_id'], ['faculty.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_payroll_records_college_id'), 'payroll_records', ['college_id'])
    op.create_index('ix_payroll_college_faculty', 'payroll_records', ['college_id', 'faculty_id'])
    op.create_index('ix_payroll_college_month', 'payroll_records', ['college_id', 'year', 'month'])

    # --- 3.17 leave_requests ---
    op.create_table('leave_requests',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('employee_type', sa.String(20), nullable=True),
        sa.Column('leave_type', sa.String(30), nullable=False),
        sa.Column('from_date', sa.Date(), nullable=False),
        sa.Column('to_date', sa.Date(), nullable=False),
        sa.Column('days', sa.Float(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('supporting_document_url', sa.String(500), nullable=True),
        sa.Column('current_approver_id', sa.UUID(), nullable=True),
        sa.Column('approval_chain', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('escalated', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('escalation_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_leave_requests_college_id'), 'leave_requests', ['college_id'])
    op.create_index('ix_leavereq_college_employee', 'leave_requests', ['college_id', 'employee_id'])
    op.create_index('ix_leavereq_college_status', 'leave_requests', ['college_id', 'status'])

    # --- 3.18 leave_balances ---
    op.create_table('leave_balances',
        sa.Column('employee_id', sa.UUID(), nullable=False),
        sa.Column('employee_type', sa.String(20), nullable=True),
        sa.Column('leave_type', sa.String(30), nullable=False),
        sa.Column('academic_year', sa.String(10), nullable=False),
        sa.Column('entitled', sa.Float(), server_default='0', nullable=True),
        sa.Column('taken', sa.Float(), server_default='0', nullable=True),
        sa.Column('pending', sa.Float(), server_default='0', nullable=True),
        sa.Column('balance', sa.Float(), server_default='0', nullable=True),
        sa.Column('carried_forward', sa.Float(), server_default='0', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_leave_balances_college_id'), 'leave_balances', ['college_id'])
    op.create_index('ix_leavebal_college_employee', 'leave_balances', ['college_id', 'employee_id'])

    # --- 3.19 recruitment_positions ---
    op.create_table('recruitment_positions',
        sa.Column('department_id', sa.UUID(), nullable=False),
        sa.Column('designation', sa.String(50), nullable=False),
        sa.Column('specialization_required', sa.String(100), nullable=True),
        sa.Column('qualification_required', sa.String(100), nullable=True),
        sa.Column('experience_required_years', sa.Float(), nullable=True),
        sa.Column('vacancies', sa.Integer(), server_default='1', nullable=True),
        sa.Column('priority', sa.String(20), server_default='medium', nullable=True),
        sa.Column('msr_impact', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('job_description', sa.Text(), nullable=True),
        sa.Column('salary_range_min', sa.BigInteger(), nullable=True),
        sa.Column('salary_range_max', sa.BigInteger(), nullable=True),
        sa.Column('status', sa.String(20), server_default='draft', nullable=True),
        sa.Column('posted_date', sa.Date(), nullable=True),
        sa.Column('deadline', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_recruitment_positions_college_id'), 'recruitment_positions', ['college_id'])
    op.create_index('ix_recruit_college_dept', 'recruitment_positions', ['college_id', 'department_id'])

    # --- 3.20 recruitment_candidates ---
    op.create_table('recruitment_candidates',
        sa.Column('position_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('current_organization', sa.String(255), nullable=True),
        sa.Column('current_designation', sa.String(100), nullable=True),
        sa.Column('qualification', sa.String(100), nullable=True),
        sa.Column('specialization', sa.String(100), nullable=True),
        sa.Column('experience_years', sa.Float(), nullable=True),
        sa.Column('publications_count', sa.Integer(), server_default='0', nullable=True),
        sa.Column('resume_url', sa.String(500), nullable=True),
        sa.Column('nmc_eligible', sa.Boolean(), nullable=True),
        sa.Column('nmc_eligibility_notes', sa.Text(), nullable=True),
        sa.Column('pipeline_stage', sa.String(20), server_default='applied', nullable=True),
        sa.Column('interview_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('interview_notes', sa.Text(), nullable=True),
        sa.Column('offer_amount', sa.BigInteger(), nullable=True),
        sa.Column('offer_date', sa.Date(), nullable=True),
        sa.Column('joining_date', sa.Date(), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['position_id'], ['recruitment_positions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_recruitment_candidates_college_id'), 'recruitment_candidates', ['college_id'])
    op.create_index('ix_candidate_college_position', 'recruitment_candidates', ['college_id', 'position_id'])

    # --- 3.21 certificates ---
    op.create_table('certificates',
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('certificate_type', sa.String(30), nullable=False),
        sa.Column('certificate_number', sa.String(50), nullable=True),
        sa.Column('purpose', sa.String(255), nullable=True),
        sa.Column('purpose_detail', sa.Text(), nullable=True),
        sa.Column('qr_code_data', sa.String(500), nullable=True),
        sa.Column('qr_verification_url', sa.String(500), nullable=True),
        sa.Column('digital_signature_applied', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('signed_by', sa.String(255), nullable=True),
        sa.Column('file_url', sa.String(500), nullable=True),
        sa.Column('status', sa.String(20), server_default='generated', nullable=True),
        sa.Column('issued_date', sa.Date(), nullable=True),
        sa.Column('revoked_date', sa.Date(), nullable=True),
        sa.Column('revocation_reason', sa.Text(), nullable=True),
        sa.Column('generated_by', sa.UUID(), nullable=True),
        sa.Column('custom_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('certificate_number'),
    )
    op.create_index(op.f('ix_certificates_college_id'), 'certificates', ['college_id'])
    op.create_index('ix_cert_college_student', 'certificates', ['college_id', 'student_id'])

    # --- 3.22 alumni ---
    op.create_table('alumni',
        sa.Column('student_id', sa.UUID(), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('graduation_year', sa.Integer(), nullable=True),
        sa.Column('batch', sa.String(50), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('current_position', sa.String(255), nullable=True),
        sa.Column('current_organization', sa.String(255), nullable=True),
        sa.Column('current_location_city', sa.String(100), nullable=True),
        sa.Column('current_location_state', sa.String(100), nullable=True),
        sa.Column('current_location_country', sa.String(100), server_default='India', nullable=True),
        sa.Column('pg_qualification', sa.String(100), nullable=True),
        sa.Column('pg_specialization', sa.String(100), nullable=True),
        sa.Column('pg_institution', sa.String(255), nullable=True),
        sa.Column('pg_year', sa.Integer(), nullable=True),
        sa.Column('employment_type', sa.String(30), nullable=True),
        sa.Column('is_active_member', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('last_engagement_date', sa.Date(), nullable=True),
        sa.Column('contributions', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_alumni_college_id'), 'alumni', ['college_id'])

    # --- 3.23 hostel_allocations ---
    op.create_table('hostel_allocations',
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('room_id', sa.UUID(), nullable=False),
        sa.Column('block_id', sa.UUID(), nullable=False),
        sa.Column('academic_year', sa.String(10), nullable=True),
        sa.Column('check_in_date', sa.Date(), nullable=True),
        sa.Column('check_out_date', sa.Date(), nullable=True),
        sa.Column('status', sa.String(20), server_default='active', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['block_id'], ['hostel_blocks.id']),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['room_id'], ['hostel_rooms.id']),
        sa.ForeignKeyConstraint(['student_id'], ['students.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_hostel_allocations_college_id'), 'hostel_allocations', ['college_id'])
    op.create_index('ix_hostelalloc_college_student', 'hostel_allocations', ['college_id', 'student_id'])

    # --- 3.24 transport_bookings ---
    op.create_table('transport_bookings',
        sa.Column('route_id', sa.UUID(), nullable=True),
        sa.Column('department_id', sa.UUID(), nullable=True),
        sa.Column('requested_by', sa.UUID(), nullable=True),
        sa.Column('booking_date', sa.Date(), nullable=False),
        sa.Column('departure_time', sa.String(10), nullable=True),
        sa.Column('num_passengers', sa.Integer(), nullable=True),
        sa.Column('purpose', sa.Text(), nullable=True),
        sa.Column('faculty_accompanying', sa.String(255), nullable=True),
        sa.Column('vehicle_id', sa.UUID(), nullable=True),
        sa.Column('status', sa.String(20), server_default='requested', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['route_id'], ['transport_routes.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_transport_bookings_college_id'), 'transport_bookings', ['college_id'])

    # --- 3.25 vehicle_maintenance_logs ---
    op.create_table('vehicle_maintenance_logs',
        sa.Column('vehicle_id', sa.UUID(), nullable=False),
        sa.Column('maintenance_type', sa.String(20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('cost', sa.BigInteger(), nullable=True),
        sa.Column('vendor', sa.String(255), nullable=True),
        sa.Column('date', sa.Date(), nullable=True),
        sa.Column('km_reading', sa.Integer(), nullable=True),
        sa.Column('next_scheduled', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['vehicle_id'], ['vehicles.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_vehicle_maintenance_logs_college_id'), 'vehicle_maintenance_logs', ['college_id'])

    # --- 3.26 library_books ---
    op.create_table('library_books',
        sa.Column('accession_number', sa.String(50), nullable=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('author', sa.String(500), nullable=True),
        sa.Column('publisher', sa.String(255), nullable=True),
        sa.Column('year_of_publication', sa.Integer(), nullable=True),
        sa.Column('edition', sa.String(50), nullable=True),
        sa.Column('isbn', sa.String(20), nullable=True),
        sa.Column('subject', sa.String(100), nullable=True),
        sa.Column('department_id', sa.UUID(), nullable=True),
        sa.Column('location', sa.String(50), nullable=True),
        sa.Column('shelf_number', sa.String(20), nullable=True),
        sa.Column('total_copies', sa.Integer(), server_default='1', nullable=True),
        sa.Column('available_copies', sa.Integer(), server_default='1', nullable=True),
        sa.Column('status', sa.String(20), server_default='available', nullable=True),
        sa.Column('price', sa.BigInteger(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('accession_number'),
    )
    op.create_index(op.f('ix_library_books_college_id'), 'library_books', ['college_id'])
    op.create_index('ix_libbook_college_dept', 'library_books', ['college_id', 'department_id'])

    # --- 3.27 library_journals ---
    op.create_table('library_journals',
        sa.Column('name', sa.String(500), nullable=False),
        sa.Column('publisher', sa.String(255), nullable=True),
        sa.Column('issn', sa.String(20), nullable=True),
        sa.Column('journal_type', sa.String(20), nullable=True),
        sa.Column('indexed_in', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('subscription_status', sa.String(20), server_default='active', nullable=True),
        sa.Column('subscription_start', sa.Date(), nullable=True),
        sa.Column('subscription_end', sa.Date(), nullable=True),
        sa.Column('annual_cost', sa.BigInteger(), nullable=True),
        sa.Column('is_online', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('access_url', sa.String(500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_library_journals_college_id'), 'library_journals', ['college_id'])

    # --- 3.28 library_issuances ---
    op.create_table('library_issuances',
        sa.Column('book_id', sa.UUID(), nullable=False),
        sa.Column('borrower_id', sa.UUID(), nullable=False),
        sa.Column('borrower_type', sa.String(20), nullable=True),
        sa.Column('issued_date', sa.Date(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('returned_date', sa.Date(), nullable=True),
        sa.Column('fine_amount', sa.BigInteger(), server_default='0', nullable=True),
        sa.Column('status', sa.String(20), server_default='issued', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['library_books.id']),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_library_issuances_college_id'), 'library_issuances', ['college_id'])
    op.create_index('ix_libissue_college_borrower', 'library_issuances', ['college_id', 'borrower_id'])

    # --- 3.29 equipment ---
    op.create_table('equipment',
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('department_id', sa.UUID(), nullable=False),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('make_model', sa.String(255), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('purchase_cost', sa.BigInteger(), nullable=True),
        sa.Column('supplier_vendor', sa.String(255), nullable=True),
        sa.Column('warranty_expiry', sa.Date(), nullable=True),
        sa.Column('amc_status', sa.String(20), server_default='not_covered', nullable=True),
        sa.Column('amc_vendor', sa.String(255), nullable=True),
        sa.Column('amc_start_date', sa.Date(), nullable=True),
        sa.Column('amc_end_date', sa.Date(), nullable=True),
        sa.Column('amc_annual_cost', sa.BigInteger(), nullable=True),
        sa.Column('requires_calibration', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('last_calibration_date', sa.Date(), nullable=True),
        sa.Column('next_calibration_due', sa.Date(), nullable=True),
        sa.Column('calibration_vendor', sa.String(255), nullable=True),
        sa.Column('condition', sa.String(20), server_default='working', nullable=True),
        sa.Column('location', sa.String(100), nullable=True),
        sa.Column('is_nmc_required', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('nmc_specification_met', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_equipment_college_id'), 'equipment', ['college_id'])
    op.create_index('ix_equip_college_dept', 'equipment', ['college_id', 'department_id'])

    # --- 3.30 maintenance_tickets ---
    op.create_table('maintenance_tickets',
        sa.Column('ticket_number', sa.String(50), nullable=True),
        sa.Column('entity_type', sa.String(20), nullable=True),
        sa.Column('entity_id', sa.UUID(), nullable=True),
        sa.Column('department_id', sa.UUID(), nullable=True),
        sa.Column('reported_by', sa.UUID(), nullable=True),
        sa.Column('reported_by_name', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(20), server_default='medium', nullable=True),
        sa.Column('status', sa.String(20), server_default='open', nullable=True),
        sa.Column('assigned_to', sa.String(255), nullable=True),
        sa.Column('resolution_description', sa.Text(), nullable=True),
        sa.Column('resolution_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cost', sa.BigInteger(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_number'),
    )
    op.create_index(op.f('ix_maintenance_tickets_college_id'), 'maintenance_tickets', ['college_id'])
    op.create_index('ix_maint_college_dept', 'maintenance_tickets', ['college_id', 'department_id'])

    # --- 3.31 notice_read_receipts ---
    op.create_table('notice_read_receipts',
        sa.Column('notice_id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('channel', sa.String(20), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['notice_id'], ['notices.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_notice_read_receipts_college_id'), 'notice_read_receipts', ['college_id'])
    op.create_index('ix_noticerr_college_notice', 'notice_read_receipts', ['college_id', 'notice_id'])

    # --- 3.32 committee_members ---
    op.create_table('committee_members',
        sa.Column('committee_id', sa.UUID(), nullable=False),
        sa.Column('member_name', sa.String(255), nullable=False),
        sa.Column('member_role', sa.String(100), nullable=True),
        sa.Column('member_type', sa.String(20), nullable=True),
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('contact_phone', sa.String(20), nullable=True),
        sa.Column('contact_email', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['committee_id'], ['committees.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_committee_members_college_id'), 'committee_members', ['college_id'])
    op.create_index('ix_commember_college_committee', 'committee_members', ['college_id', 'committee_id'])

    # --- 3.33 grievances ---
    op.create_table('grievances',
        sa.Column('ticket_number', sa.String(50), nullable=True),
        sa.Column('filed_by', sa.UUID(), nullable=True),
        sa.Column('filed_by_name', sa.String(255), nullable=True),
        sa.Column('filed_by_role', sa.String(20), nullable=True),
        sa.Column('is_anonymous', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('category', sa.String(30), nullable=True),
        sa.Column('assigned_committee_id', sa.UUID(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('evidence_urls', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('priority', sa.String(20), server_default='medium', nullable=True),
        sa.Column('status', sa.String(20), server_default='filed', nullable=True),
        sa.Column('resolution_description', sa.Text(), nullable=True),
        sa.Column('resolution_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolved_by', sa.UUID(), nullable=True),
        sa.Column('timeline', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['assigned_committee_id'], ['committees.id']),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ticket_number'),
    )
    op.create_index(op.f('ix_grievances_college_id'), 'grievances', ['college_id'])
    op.create_index('ix_grievance_college_status', 'grievances', ['college_id', 'status'])

    # --- 3.34 workflow_instances ---
    op.create_table('workflow_instances',
        sa.Column('definition_id', sa.UUID(), nullable=True),
        sa.Column('workflow_type', sa.String(30), nullable=False),
        sa.Column('reference_type', sa.String(30), nullable=True),
        sa.Column('reference_id', sa.UUID(), nullable=True),
        sa.Column('requested_by', sa.UUID(), nullable=False),
        sa.Column('requested_by_name', sa.String(255), nullable=True),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('current_step', sa.Integer(), server_default='1', nullable=True),
        sa.Column('current_approver_id', sa.UUID(), nullable=True),
        sa.Column('approval_history', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending', nullable=True),
        sa.Column('priority', sa.String(20), server_default='normal', nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['definition_id'], ['workflow_definitions.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_workflow_instances_college_id'), 'workflow_instances', ['college_id'])
    op.create_index('ix_wfinst_college_status', 'workflow_instances', ['college_id', 'status'])
    op.create_index('ix_wfinst_college_approver', 'workflow_instances', ['college_id', 'current_approver_id'])

    # --- 3.35 documents ---
    op.create_table('documents',
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('sub_category', sa.String(100), nullable=True),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('uploaded_by', sa.UUID(), nullable=True),
        sa.Column('uploaded_by_name', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('access_level', sa.String(20), server_default='admin_only', nullable=True),
        sa.Column('version', sa.Integer(), server_default='1', nullable=True),
        sa.Column('parent_document_id', sa.UUID(), nullable=True),
        sa.Column('academic_year', sa.String(10), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['parent_document_id'], ['documents.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_documents_college_id'), 'documents', ['college_id'])
    op.create_index('ix_doc_college_category', 'documents', ['college_id', 'category'])

    # --- 3.36 academic_calendar_events ---
    op.create_table('academic_calendar_events',
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('event_type', sa.String(30), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_all_day', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('start_time', sa.String(10), nullable=True),
        sa.Column('end_time', sa.String(10), nullable=True),
        sa.Column('affects_phases', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('department_id', sa.UUID(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_recurring', sa.Boolean(), server_default='false', nullable=True),
        sa.Column('recurrence_rule', sa.String(100), nullable=True),
        sa.Column('notify_roles', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('academic_year', sa.String(10), nullable=True),
        sa.Column('is_teaching_day', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_academic_calendar_events_college_id'), 'academic_calendar_events', ['college_id'])

    # --- 3.37 timetable_slots ---
    op.create_table('timetable_slots',
        sa.Column('academic_year', sa.String(10), nullable=False),
        sa.Column('phase', sa.String(20), nullable=False),
        sa.Column('batch_id', sa.UUID(), nullable=True),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.String(10), nullable=False),
        sa.Column('end_time', sa.String(10), nullable=False),
        sa.Column('subject', sa.String(100), nullable=True),
        sa.Column('department_id', sa.UUID(), nullable=True),
        sa.Column('faculty_id', sa.UUID(), nullable=True),
        sa.Column('session_type', sa.String(20), nullable=True),
        sa.Column('room_id', sa.UUID(), nullable=True),
        sa.Column('room_name', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=True),
        sa.Column('effective_from', sa.Date(), nullable=True),
        sa.Column('effective_until', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('college_id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.ForeignKeyConstraint(['batch_id'], ['batches.id']),
        sa.ForeignKeyConstraint(['college_id'], ['colleges.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id']),
        sa.ForeignKeyConstraint(['faculty_id'], ['faculty.id']),
        sa.ForeignKeyConstraint(['room_id'], ['infrastructure.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_timetable_slots_college_id'), 'timetable_slots', ['college_id'])
    op.create_index('ix_timetable_college_phase_day', 'timetable_slots',
                    ['college_id', 'phase', 'day_of_week'])

    # ==================================================================
    # PART 4: RLS policies for all new tenant-scoped tables
    # ==================================================================
    for table in ADMIN_TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"""
            CREATE POLICY tenant_isolation_policy ON {table}
                USING (
                    college_id = NULLIF(current_setting('app.current_college_id', true), '')::uuid
                )
        """)
        op.execute(f"""
            CREATE POLICY superadmin_bypass_policy ON {table}
                USING (
                    current_setting('app.is_superadmin', true) = 'true'
                )
        """)


def downgrade() -> None:
    # ==================================================================
    # Drop RLS policies
    # ==================================================================
    for table in reversed(ADMIN_TENANT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS superadmin_bypass_policy ON {table}")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation_policy ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    # ==================================================================
    # Drop new tables in reverse dependency order
    # ==================================================================
    op.drop_index('ix_timetable_college_phase_day', table_name='timetable_slots')
    op.drop_index(op.f('ix_timetable_slots_college_id'), table_name='timetable_slots')
    op.drop_table('timetable_slots')

    op.drop_index(op.f('ix_academic_calendar_events_college_id'), table_name='academic_calendar_events')
    op.drop_table('academic_calendar_events')

    op.drop_index('ix_doc_college_category', table_name='documents')
    op.drop_index(op.f('ix_documents_college_id'), table_name='documents')
    op.drop_table('documents')

    op.drop_index('ix_wfinst_college_approver', table_name='workflow_instances')
    op.drop_index('ix_wfinst_college_status', table_name='workflow_instances')
    op.drop_index(op.f('ix_workflow_instances_college_id'), table_name='workflow_instances')
    op.drop_table('workflow_instances')

    op.drop_index('ix_grievance_college_status', table_name='grievances')
    op.drop_index(op.f('ix_grievances_college_id'), table_name='grievances')
    op.drop_table('grievances')

    op.drop_index('ix_commember_college_committee', table_name='committee_members')
    op.drop_index(op.f('ix_committee_members_college_id'), table_name='committee_members')
    op.drop_table('committee_members')

    op.drop_index('ix_noticerr_college_notice', table_name='notice_read_receipts')
    op.drop_index(op.f('ix_notice_read_receipts_college_id'), table_name='notice_read_receipts')
    op.drop_table('notice_read_receipts')

    op.drop_index('ix_maint_college_dept', table_name='maintenance_tickets')
    op.drop_index(op.f('ix_maintenance_tickets_college_id'), table_name='maintenance_tickets')
    op.drop_table('maintenance_tickets')

    op.drop_index('ix_equip_college_dept', table_name='equipment')
    op.drop_index(op.f('ix_equipment_college_id'), table_name='equipment')
    op.drop_table('equipment')

    op.drop_index('ix_libissue_college_borrower', table_name='library_issuances')
    op.drop_index(op.f('ix_library_issuances_college_id'), table_name='library_issuances')
    op.drop_table('library_issuances')

    op.drop_index(op.f('ix_library_journals_college_id'), table_name='library_journals')
    op.drop_table('library_journals')

    op.drop_index('ix_libbook_college_dept', table_name='library_books')
    op.drop_index(op.f('ix_library_books_college_id'), table_name='library_books')
    op.drop_table('library_books')

    op.drop_index(op.f('ix_vehicle_maintenance_logs_college_id'), table_name='vehicle_maintenance_logs')
    op.drop_table('vehicle_maintenance_logs')

    op.drop_index(op.f('ix_transport_bookings_college_id'), table_name='transport_bookings')
    op.drop_table('transport_bookings')

    op.drop_index('ix_hostelalloc_college_student', table_name='hostel_allocations')
    op.drop_index(op.f('ix_hostel_allocations_college_id'), table_name='hostel_allocations')
    op.drop_table('hostel_allocations')

    op.drop_index(op.f('ix_alumni_college_id'), table_name='alumni')
    op.drop_table('alumni')

    op.drop_index('ix_cert_college_student', table_name='certificates')
    op.drop_index(op.f('ix_certificates_college_id'), table_name='certificates')
    op.drop_table('certificates')

    op.drop_index('ix_candidate_college_position', table_name='recruitment_candidates')
    op.drop_index(op.f('ix_recruitment_candidates_college_id'), table_name='recruitment_candidates')
    op.drop_table('recruitment_candidates')

    op.drop_index('ix_recruit_college_dept', table_name='recruitment_positions')
    op.drop_index(op.f('ix_recruitment_positions_college_id'), table_name='recruitment_positions')
    op.drop_table('recruitment_positions')

    op.drop_index('ix_leavebal_college_employee', table_name='leave_balances')
    op.drop_index(op.f('ix_leave_balances_college_id'), table_name='leave_balances')
    op.drop_table('leave_balances')

    op.drop_index('ix_leavereq_college_status', table_name='leave_requests')
    op.drop_index('ix_leavereq_college_employee', table_name='leave_requests')
    op.drop_index(op.f('ix_leave_requests_college_id'), table_name='leave_requests')
    op.drop_table('leave_requests')

    op.drop_index('ix_payroll_college_month', table_name='payroll_records')
    op.drop_index('ix_payroll_college_faculty', table_name='payroll_records')
    op.drop_index(op.f('ix_payroll_records_college_id'), table_name='payroll_records')
    op.drop_table('payroll_records')

    op.drop_index('ix_studschol_college_status', table_name='student_scholarships')
    op.drop_index('ix_studschol_college_student', table_name='student_scholarships')
    op.drop_index(op.f('ix_student_scholarships_college_id'), table_name='student_scholarships')
    op.drop_table('student_scholarships')

    op.drop_index('ix_feerefund_college_student', table_name='fee_refunds')
    op.drop_index(op.f('ix_fee_refunds_college_id'), table_name='fee_refunds')
    op.drop_table('fee_refunds')

    op.drop_index('ix_facqual_college_faculty', table_name='faculty_qualifications')
    op.drop_index(op.f('ix_faculty_qualifications_college_id'), table_name='faculty_qualifications')
    op.drop_table('faculty_qualifications')

    op.drop_index('ix_studdoc_college_student', table_name='student_documents')
    op.drop_index(op.f('ix_student_documents_college_id'), table_name='student_documents')
    op.drop_table('student_documents')

    op.drop_index('ix_infra_college_dept', table_name='infrastructure')
    op.drop_index(op.f('ix_infrastructure_college_id'), table_name='infrastructure')
    op.drop_table('infrastructure')

    op.drop_index(op.f('ix_transport_routes_college_id'), table_name='transport_routes')
    op.drop_table('transport_routes')

    # Drop students.hostel_room_id FK before dropping hostel_rooms
    op.drop_constraint('fk_students_hostel_room', 'students', type_='foreignkey')
    op.drop_column('students', 'hostel_room_id')

    op.drop_index('ix_hostelroom_college_block', table_name='hostel_rooms')
    op.drop_index(op.f('ix_hostel_rooms_college_id'), table_name='hostel_rooms')
    op.drop_table('hostel_rooms')

    op.drop_index(op.f('ix_hostel_blocks_college_id'), table_name='hostel_blocks')
    op.drop_table('hostel_blocks')

    op.drop_index(op.f('ix_vehicles_college_id'), table_name='vehicles')
    op.drop_table('vehicles')

    op.drop_index(op.f('ix_committees_college_id'), table_name='committees')
    op.drop_table('committees')

    op.drop_index('ix_notice_college_status', table_name='notices')
    op.drop_index(op.f('ix_notices_college_id'), table_name='notices')
    op.drop_table('notices')

    op.drop_index(op.f('ix_workflow_definitions_college_id'), table_name='workflow_definitions')
    op.drop_table('workflow_definitions')

    op.drop_index(op.f('ix_mess_units_college_id'), table_name='mess_units')
    op.drop_table('mess_units')

    op.drop_index(op.f('ix_salary_structures_college_id'), table_name='salary_structures')
    op.drop_table('salary_structures')

    op.drop_index(op.f('ix_leave_policies_college_id'), table_name='leave_policies')
    op.drop_table('leave_policies')

    op.drop_table('scholarship_schemes')

    # ==================================================================
    # Revert column additions on existing tables (reverse order)
    # ==================================================================

    # --- clinical_rotations ---
    op.drop_constraint('fk_clinrot_supervisor', 'clinical_rotations', type_='foreignkey')
    op.drop_index('ix_clinrot_college_dept', table_name='clinical_rotations')
    op.drop_index('ix_clinrot_college_student', table_name='clinical_rotations')
    op.drop_column('clinical_rotations', 'crmi_leave_days_taken')
    op.drop_column('clinical_rotations', 'is_crmi')
    op.drop_column('clinical_rotations', 'attendance_percentage')
    op.drop_column('clinical_rotations', 'supervisor_faculty_id')
    op.drop_column('clinical_rotations', 'phase')
    op.drop_column('clinical_rotations', 'rotation_group')

    # --- fee_payments ---
    op.drop_index('ix_feepay_college_status', table_name='fee_payments')
    op.drop_index('ix_feepay_college_student', table_name='fee_payments')
    op.drop_column('fee_payments', 'notes')
    op.drop_column('fee_payments', 'recorded_by')
    op.drop_column('fee_payments', 'late_fee_days')
    op.drop_column('fee_payments', 'late_fee_amount')
    op.drop_column('fee_payments', 'fee_breakdown')
    op.drop_column('fee_payments', 'payment_date')
    op.drop_column('fee_payments', 'bank_name')
    op.drop_column('fee_payments', 'reference_number')
    op.drop_column('fee_payments', 'razorpay_signature')
    op.drop_column('fee_payments', 'academic_year')

    # --- fee_structures ---
    op.drop_index('ix_feestruct_college_year_quota', table_name='fee_structures')
    op.drop_column('fee_structures', 'is_active')
    op.drop_column('fee_structures', 'grace_period_days')
    op.drop_column('fee_structures', 'late_fee_per_day')
    op.drop_column('fee_structures', 'installment_config')
    op.drop_column('fee_structures', 'approval_document_url')
    op.drop_column('fee_structures', 'approval_date')
    op.drop_column('fee_structures', 'other_fees_description')
    op.drop_column('fee_structures', 'other_fees')
    op.drop_column('fee_structures', 'identity_card_fee')
    op.drop_column('fee_structures', 'insurance_premium')
    op.drop_column('fee_structures', 'university_registration_fee')
    op.drop_column('fee_structures', 'laboratory_fee')
    op.drop_column('fee_structures', 'examination_fee')
    op.drop_column('fee_structures', 'hostel_fee_girls')
    op.drop_column('fee_structures', 'hostel_fee_boys')

    # --- faculty ---
    op.drop_index('ix_faculty_college_status', table_name='faculty')
    op.drop_index('ix_faculty_college_dept', table_name='faculty')
    op.drop_column('faculty', 'bank_name')
    op.drop_column('faculty', 'bank_ifsc')
    op.drop_column('faculty', 'bank_account_number_hash')
    op.drop_column('faculty', 'bcme_completed')
    op.drop_column('faculty', 'h_index')
    op.drop_column('faculty', 'publications_count')
    op.drop_column('faculty', 'orcid_id')
    op.drop_column('faculty', 'total_experience_years')
    op.drop_column('faculty', 'pay_scale_type')
    op.drop_column('faculty', 'employee_id')
    op.drop_column('faculty', 'sub_specialization')
    op.drop_column('faculty', 'pin_code')
    op.drop_column('faculty', 'state')
    op.drop_column('faculty', 'city')
    op.drop_column('faculty', 'permanent_address')
    op.drop_column('faculty', 'pan_number_hash')
    op.drop_column('faculty', 'aadhaar_hash')
    op.drop_column('faculty', 'photo_url')
    op.drop_column('faculty', 'gender')

    # --- students ---
    op.drop_index('ix_student_college_phase', table_name='students')
    op.drop_index('ix_student_college_batch', table_name='students')
    op.drop_index('ix_student_college_status', table_name='students')
    op.drop_constraint('fk_students_batch_id', 'students', type_='foreignkey')
    op.alter_column('students', 'current_phase',
                    existing_type=sa.String(20), type_=sa.String(10))
    op.drop_column('students', 'nmc_upload_date')
    op.drop_column('students', 'nmc_uploaded')
    op.drop_column('students', 'is_hosteler')
    op.drop_column('students', 'batch_id')
    op.drop_column('students', 'gap_years')
    op.drop_column('students', 'pcb_percentage')
    op.drop_column('students', 'class_12_percentage')
    op.drop_column('students', 'class_12_board')
    op.drop_column('students', 'class_10_percentage')
    op.drop_column('students', 'class_10_board')
    op.drop_column('students', 'admission_date')
    op.drop_column('students', 'allotment_order_number')
    op.drop_column('students', 'counseling_round')
    op.drop_column('students', 'neet_year')
    op.drop_column('students', 'pin_code')
    op.drop_column('students', 'state')
    op.drop_column('students', 'city')
    op.drop_column('students', 'permanent_address')
    op.drop_column('students', 'emergency_contact_phone')
    op.drop_column('students', 'emergency_contact_name')
    op.drop_column('students', 'guardian_email')
    op.drop_column('students', 'guardian_phone')
    op.drop_column('students', 'mother_name')
    op.drop_column('students', 'father_name')
    op.drop_column('students', 'photo_url')
    op.drop_column('students', 'category')
    op.drop_column('students', 'religion')
    op.drop_column('students', 'nationality')
    op.drop_column('students', 'blood_group')

    # --- batches ---
    op.drop_column('batches', 'is_active')
    op.drop_column('batches', 'current_semester')
    op.drop_column('batches', 'current_phase')
    op.drop_column('batches', 'batch_type')

    # --- departments ---
    op.drop_index('ix_dept_college_active', table_name='departments')
    op.drop_column('departments', 'display_order')
    op.drop_column('departments', 'nmc_department_code')
    op.drop_column('departments', 'lecture_halls')
    op.drop_column('departments', 'labs')
    op.drop_column('departments', 'opd_rooms')
    op.drop_column('departments', 'beds')
    op.drop_column('departments', 'department_type')

    # --- colleges ---
    op.drop_constraint('uq_colleges_nmc_reg', 'colleges', type_='unique')
    op.drop_column('colleges', 'status')
    op.drop_column('colleges', 'logo_url')
    op.drop_column('colleges', 'sanctioned_intake')
    op.drop_column('colleges', 'college_type')
    op.drop_column('colleges', 'established_year')
    op.drop_column('colleges', 'website')
    op.drop_column('colleges', 'email')
    op.drop_column('colleges', 'phone')
    op.drop_column('colleges', 'pin_code')
    op.drop_column('colleges', 'city')
    op.drop_column('colleges', 'address')
    op.drop_column('colleges', 'nmc_registration_number')

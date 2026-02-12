'use client';

import { useState } from 'react';
import { useOnboardCollege, useOnboardingStatus } from '@/lib/platform-api';

const PLAN_TIERS = ['pilot', 'starter', 'professional', 'enterprise'] as const;

const PLAN_DEFAULTS: Record<
  string,
  { max_students: number; max_faculty: number; ai_budget: number; storage_gb: number }
> = {
  pilot: { max_students: 150, max_faculty: 50, ai_budget: 50, storage_gb: 10 },
  starter: { max_students: 500, max_faculty: 150, ai_budget: 200, storage_gb: 50 },
  professional: { max_students: 2000, max_faculty: 500, ai_budget: 500, storage_gb: 200 },
  enterprise: { max_students: 10000, max_faculty: 2000, ai_budget: 2000, storage_gb: 1000 },
};

interface Department {
  name: string;
  code: string;
  type: string;
}

const STEPS = [
  'College Details',
  'Plan & Limits',
  'Contacts',
  'Departments',
  'Review',
] as const;

export default function CollegeOnboardingPage() {
  const onboard = useOnboardCollege();
  const { data: statusList } = useOnboardingStatus();

  const [step, setStep] = useState(0);
  const [showWizard, setShowWizard] = useState(false);

  // Form state
  const [college, setCollege] = useState({
    name: '',
    code: '',
    state: '',
    university: '',
  });
  const [plan, setPlan] = useState({
    plan_tier: 'starter' as string,
    billing_cycle: 'annual' as string,
    contract_value_inr: '',
    max_students: 500,
    max_faculty: 150,
    ai_budget: 200,
    storage_gb: 50,
  });
  const [contacts, setContacts] = useState({
    dean_email: '',
    admin_email: '',
    dean_name: '',
    admin_name: '',
  });
  const [departments, setDepartments] = useState<Department[]>([
    { name: '', code: '', type: 'clinical' },
  ]);

  const handlePlanChange = (tier: string) => {
    const defaults = PLAN_DEFAULTS[tier] ?? PLAN_DEFAULTS.starter;
    setPlan({
      ...plan,
      plan_tier: tier,
      max_students: defaults.max_students,
      max_faculty: defaults.max_faculty,
      ai_budget: defaults.ai_budget,
      storage_gb: defaults.storage_gb,
    });
  };

  const addDepartment = () => {
    setDepartments([...departments, { name: '', code: '', type: 'clinical' }]);
  };

  const removeDepartment = (idx: number) => {
    setDepartments(departments.filter((_, i) => i !== idx));
  };

  const updateDepartment = (idx: number, field: keyof Department, value: string) => {
    const updated = [...departments];
    updated[idx] = { ...updated[idx], [field]: value };
    setDepartments(updated);
  };

  const canAdvance = () => {
    switch (step) {
      case 0:
        return college.name.trim().length > 0;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return departments.some((d) => d.name.trim().length > 0);
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    const payload: Record<string, unknown> = {
      college_name: college.name,
      college_code: college.code || undefined,
      state: college.state || undefined,
      university: college.university || undefined,
      plan_tier: plan.plan_tier,
      billing_cycle: plan.billing_cycle,
      contract_value_inr: plan.contract_value_inr
        ? parseInt(plan.contract_value_inr)
        : undefined,
      max_students: plan.max_students,
      max_faculty: plan.max_faculty,
      monthly_ai_budget_usd: plan.ai_budget,
      max_storage_gb: plan.storage_gb,
      dean_email: contacts.dean_email || undefined,
      admin_email: contacts.admin_email || undefined,
      dean_name: contacts.dean_name || undefined,
      admin_name: contacts.admin_name || undefined,
      departments: departments
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name,
          code: d.code || undefined,
          type: d.type,
        })),
    };

    try {
      await onboard.mutateAsync(payload);
      setShowWizard(false);
      setStep(0);
      // Reset form
      setCollege({ name: '', code: '', state: '', university: '' });
      setPlan({
        plan_tier: 'starter',
        billing_cycle: 'annual',
        contract_value_inr: '',
        max_students: 500,
        max_faculty: 150,
        ai_budget: 200,
        storage_gb: 50,
      });
      setContacts({ dean_email: '', admin_email: '', dean_name: '', admin_name: '' });
      setDepartments([{ name: '', code: '', type: 'clinical' }]);
    } catch {
      // Error in mutation state
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">College Onboarding</h1>
        <button
          onClick={() => { setShowWizard(true); setStep(0); }}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          Onboard New College
        </button>
      </div>

      {/* Onboarding status table */}
      <div className="rounded-lg border border-dark-border">
        <div className="border-b border-dark-border bg-dark-surface px-4 py-3">
          <h3 className="text-sm font-medium text-gray-400">
            Recent Onboardings
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-border bg-dark-surface text-left text-xs text-gray-500">
                <th className="px-4 py-2.5">College</th>
                <th className="px-3 py-2.5">Plan</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Created</th>
                <th className="px-3 py-2.5">Age</th>
              </tr>
            </thead>
            <tbody>
              {(!statusList || statusList.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No onboarding records
                  </td>
                </tr>
              )}
              {statusList?.map((entry) => (
                <tr
                  key={entry.college_id}
                  className="border-b border-dark-border hover:bg-dark-elevated"
                >
                  <td className="px-4 py-2.5">
                    <p className="text-xs font-medium text-white">
                      {entry.college_name}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {entry.college_id.slice(0, 8)}...
                    </p>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="rounded bg-dark-elevated px-1.5 py-0.5 text-[10px] font-medium text-gray-300">
                      {entry.plan_tier}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        entry.status === 'active'
                          ? 'bg-green-500/10 text-green-400'
                          : entry.is_stalled
                            ? 'bg-red-500/10 text-red-400'
                            : 'bg-yellow-500/10 text-yellow-400'
                      }`}
                    >
                      {entry.is_stalled ? 'stalled' : entry.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-gray-400">
                    {entry.days_since_created}d
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wizard modal */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl rounded-xl border border-dark-border bg-dark-surface p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold">Onboard New College</h2>
              <button
                onClick={() => setShowWizard(false)}
                className="text-gray-500 hover:text-white"
              >
                &times;
              </button>
            </div>

            {/* Step indicators */}
            <div className="mb-6 flex gap-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1">
                  <div
                    className={`h-1 rounded-full ${
                      i <= step ? 'bg-brand-500' : 'bg-dark-muted'
                    }`}
                  />
                  <p
                    className={`mt-1 text-[10px] ${
                      i === step ? 'text-brand-500' : 'text-gray-500'
                    }`}
                  >
                    {s}
                  </p>
                </div>
              ))}
            </div>

            {/* Step content */}
            <div className="min-h-[280px]">
              {/* Step 0: College Details */}
              {step === 0 && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      College Name *
                    </label>
                    <input
                      value={college.name}
                      onChange={(e) =>
                        setCollege({ ...college, name: e.target.value })
                      }
                      className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      placeholder="Government Medical College, Thiruvananthapuram"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        College Code
                      </label>
                      <input
                        value={college.code}
                        onChange={(e) =>
                          setCollege({ ...college, code: e.target.value })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                        placeholder="GMC-TVM"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        State
                      </label>
                      <input
                        value={college.state}
                        onChange={(e) =>
                          setCollege({ ...college, state: e.target.value })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                        placeholder="Kerala"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      University
                    </label>
                    <input
                      value={college.university}
                      onChange={(e) =>
                        setCollege({ ...college, university: e.target.value })
                      }
                      className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      placeholder="Kerala University of Health Sciences"
                    />
                  </div>
                </div>
              )}

              {/* Step 1: Plan & Limits */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Plan Tier
                      </label>
                      <select
                        value={plan.plan_tier}
                        onChange={(e) => handlePlanChange(e.target.value)}
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      >
                        {PLAN_TIERS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Billing Cycle
                      </label>
                      <select
                        value={plan.billing_cycle}
                        onChange={(e) =>
                          setPlan({ ...plan, billing_cycle: e.target.value })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      >
                        <option value="annual">Annual</option>
                        <option value="semi_annual">Semi-Annual</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-400">
                      Contract Value (INR)
                    </label>
                    <input
                      type="number"
                      value={plan.contract_value_inr}
                      onChange={(e) =>
                        setPlan({ ...plan, contract_value_inr: e.target.value })
                      }
                      className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      placeholder="4500000"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Max Students
                      </label>
                      <input
                        type="number"
                        value={plan.max_students}
                        onChange={(e) =>
                          setPlan({
                            ...plan,
                            max_students: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Max Faculty
                      </label>
                      <input
                        type="number"
                        value={plan.max_faculty}
                        onChange={(e) =>
                          setPlan({
                            ...plan,
                            max_faculty: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        AI Budget (USD/mo)
                      </label>
                      <input
                        type="number"
                        value={plan.ai_budget}
                        onChange={(e) =>
                          setPlan({
                            ...plan,
                            ai_budget: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Storage (GB)
                      </label>
                      <input
                        type="number"
                        value={plan.storage_gb}
                        onChange={(e) =>
                          setPlan({
                            ...plan,
                            storage_gb: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Contacts */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Clerk invites will be sent to these emails after onboarding.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Dean Name
                      </label>
                      <input
                        value={contacts.dean_name}
                        onChange={(e) =>
                          setContacts({ ...contacts, dean_name: e.target.value })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Dean Email
                      </label>
                      <input
                        type="email"
                        value={contacts.dean_email}
                        onChange={(e) =>
                          setContacts({ ...contacts, dean_email: e.target.value })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Admin Name
                      </label>
                      <input
                        value={contacts.admin_name}
                        onChange={(e) =>
                          setContacts({ ...contacts, admin_name: e.target.value })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Admin Email
                      </label>
                      <input
                        type="email"
                        value={contacts.admin_email}
                        onChange={(e) =>
                          setContacts({
                            ...contacts,
                            admin_email: e.target.value,
                          })
                        }
                        className="w-full rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Departments */}
              {step === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      Add departments for this college.
                    </p>
                    <button
                      onClick={addDepartment}
                      className="rounded bg-dark-elevated px-2 py-1 text-[10px] text-brand-500 hover:bg-dark-muted"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="max-h-52 space-y-2 overflow-y-auto">
                    {departments.map((dept, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          placeholder="Department name"
                          value={dept.name}
                          onChange={(e) =>
                            updateDepartment(i, 'name', e.target.value)
                          }
                          className="flex-1 rounded-md border border-dark-border bg-dark-bg px-3 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                        />
                        <input
                          placeholder="Code"
                          value={dept.code}
                          onChange={(e) =>
                            updateDepartment(i, 'code', e.target.value)
                          }
                          className="w-20 rounded-md border border-dark-border bg-dark-bg px-2 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                        />
                        <select
                          value={dept.type}
                          onChange={(e) =>
                            updateDepartment(i, 'type', e.target.value)
                          }
                          className="w-28 rounded-md border border-dark-border bg-dark-bg px-2 py-1.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                        >
                          <option value="clinical">Clinical</option>
                          <option value="preclinical">Pre-clinical</option>
                          <option value="paraclinical">Para-clinical</option>
                        </select>
                        {departments.length > 1 && (
                          <button
                            onClick={() => removeDepartment(i)}
                            className="px-1 text-gray-500 hover:text-red-400"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {step === 4 && (
                <div className="space-y-4">
                  <div className="rounded border border-dark-border p-3">
                    <h4 className="mb-2 text-xs font-medium text-gray-400">
                      College
                    </h4>
                    <p className="text-sm text-white">{college.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {[college.code, college.state, college.university]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <div className="rounded border border-dark-border p-3">
                    <h4 className="mb-2 text-xs font-medium text-gray-400">
                      Plan
                    </h4>
                    <p className="text-sm text-white">
                      {plan.plan_tier} · {plan.billing_cycle}
                      {plan.contract_value_inr &&
                        ` · ₹${(parseInt(plan.contract_value_inr) / 100_000).toFixed(1)}L`}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {plan.max_students} students · {plan.max_faculty} faculty ·
                      ${plan.ai_budget}/mo AI · {plan.storage_gb}GB
                    </p>
                  </div>
                  {(contacts.dean_email || contacts.admin_email) && (
                    <div className="rounded border border-dark-border p-3">
                      <h4 className="mb-2 text-xs font-medium text-gray-400">
                        Contacts
                      </h4>
                      {contacts.dean_email && (
                        <p className="text-[10px] text-gray-300">
                          Dean: {contacts.dean_name} ({contacts.dean_email})
                        </p>
                      )}
                      {contacts.admin_email && (
                        <p className="text-[10px] text-gray-300">
                          Admin: {contacts.admin_name} ({contacts.admin_email})
                        </p>
                      )}
                    </div>
                  )}
                  <div className="rounded border border-dark-border p-3">
                    <h4 className="mb-2 text-xs font-medium text-gray-400">
                      Departments ({departments.filter((d) => d.name.trim()).length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {departments
                        .filter((d) => d.name.trim())
                        .map((d, i) => (
                          <span
                            key={i}
                            className="rounded bg-dark-elevated px-2 py-0.5 text-[10px] text-gray-300"
                          >
                            {d.name}
                          </span>
                        ))}
                    </div>
                  </div>
                  {onboard.isError && (
                    <p className="text-xs text-red-400">
                      {(onboard.error as Error).message}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="mt-6 flex justify-between">
              <button
                onClick={() => (step === 0 ? setShowWizard(false) : setStep(step - 1))}
                className="rounded-md border border-dark-border px-4 py-1.5 text-sm text-gray-400 hover:bg-dark-elevated"
              >
                {step === 0 ? 'Cancel' : 'Back'}
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  disabled={!canAdvance()}
                  onClick={() => setStep(step + 1)}
                  className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  disabled={onboard.isPending}
                  onClick={handleSubmit}
                  className="rounded-md bg-brand-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {onboard.isPending ? 'Creating...' : 'Create College'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

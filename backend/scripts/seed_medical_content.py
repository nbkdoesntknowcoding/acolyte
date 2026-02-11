"""Seed Medical Content — RAG knowledge base for development & testing.

Seeds:
- MedicalContent: 5 subjects × 10-20 chunks each = ~75 chunks
- MedicalEntity: 50+ knowledge graph nodes
- MedicalEntityRelationship: 100+ knowledge graph edges

Uses text-embedding-3-large (1536 dims) for embeddings.
Requires OPENAI_API_KEY in .env or environment.

Usage:
    cd backend
    python -m scripts.seed_medical_content          # full seed with embeddings
    python -m scripts.seed_medical_content --skip-embeddings  # fast, no API calls
    python -m scripts.seed_medical_content --dry-run          # preview counts only
"""

import asyncio
import hashlib
import logging
import sys
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Medical content data — actual medical text per subject
# ---------------------------------------------------------------------------

PHARMACOLOGY_CHUNKS = [
    {
        "title": "Metformin — Mechanism of Action",
        "content": (
            "Metformin is a biguanide oral hypoglycemic agent and the first-line drug "
            "for type 2 diabetes mellitus. Its primary mechanism involves activation of "
            "AMP-activated protein kinase (AMPK) in hepatocytes, leading to decreased "
            "hepatic glucose production via suppression of gluconeogenesis. It also "
            "enhances peripheral glucose uptake in skeletal muscle by increasing GLUT4 "
            "translocation. Unlike sulfonylureas, metformin does not stimulate insulin "
            "secretion and therefore does not cause hypoglycemia when used as monotherapy. "
            "Additional effects include reduction of intestinal glucose absorption, "
            "improvement of insulin sensitivity, and modest reduction in LDL cholesterol "
            "and triglycerides. The UKPDS trial demonstrated that metformin reduces "
            "macrovascular complications in overweight type 2 diabetics, a benefit not "
            "seen with sulfonylureas or insulin."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 19",
        "metadata": {"subject": "Pharmacology", "topic": "Antidiabetic Drugs", "book": "KD Tripathi", "chapter": "19", "page": "272"},
    },
    {
        "title": "Sulfonylureas — Classification and Mechanism",
        "content": (
            "Sulfonylureas are insulin secretagogues that bind to the SUR1 subunit of "
            "ATP-sensitive potassium channels on pancreatic beta cells. This binding "
            "closes K-ATP channels, causing membrane depolarization, opening of "
            "voltage-gated calcium channels, and subsequent insulin exocytosis. "
            "First-generation agents (tolbutamide, chlorpropamide) have largely been "
            "replaced by second-generation sulfonylureas (glibenclamide, glipizide, "
            "gliclazide, glimepiride) which have greater potency and fewer drug "
            "interactions. The major adverse effect is hypoglycemia, particularly "
            "with long-acting agents like glibenclamide. Chlorpropamide can cause "
            "SIADH-like hyponatremia and a disulfiram-like reaction with alcohol. "
            "Weight gain is common as these drugs increase insulin levels."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 19",
        "metadata": {"subject": "Pharmacology", "topic": "Antidiabetic Drugs", "book": "KD Tripathi", "chapter": "19", "page": "268"},
    },
    {
        "title": "Beta-Blockers — Pharmacological Classification",
        "content": (
            "Beta-adrenergic receptor antagonists are classified based on selectivity: "
            "Non-selective (beta-1 + beta-2): propranolol, nadolol, timolol, sotalol. "
            "Cardioselective (beta-1 selective): atenolol, metoprolol, bisoprolol, "
            "nebivolol, esmolol. Beta-blockers with alpha-blocking activity: labetalol, "
            "carvedilol. Propranolol is lipophilic, crosses the BBB (causes nightmares, "
            "depression), and undergoes extensive first-pass metabolism. Atenolol is "
            "hydrophilic with renal elimination. Esmolol is ultra-short-acting (t½ = 9 min) "
            "used in acute arrhythmias and hypertensive emergencies. Nebivolol has "
            "vasodilating properties via NO release. Contraindications include bronchial "
            "asthma (non-selective), decompensated heart failure, and Prinzmetal angina."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 9",
        "metadata": {"subject": "Pharmacology", "topic": "Adrenergic Antagonists", "book": "KD Tripathi", "chapter": "9", "page": "143"},
    },
    {
        "title": "ACE Inhibitors — Mechanism and Clinical Uses",
        "content": (
            "Angiotensin-Converting Enzyme inhibitors (captopril, enalapril, ramipril, "
            "lisinopril) block the conversion of angiotensin I to angiotensin II and "
            "inhibit bradykinin degradation. They reduce preload, afterload, and aldosterone "
            "secretion. Clinical indications include hypertension, heart failure (reduce "
            "mortality per CONSENSUS and SOLVD trials), post-MI LV dysfunction, diabetic "
            "nephropathy (HOPE trial), and scleroderma renal crisis. Dry cough occurs in "
            "10-15% due to bradykinin accumulation. Angioedema is rare but life-threatening. "
            "Contraindicated in pregnancy (teratogenic — renal agenesis), bilateral renal "
            "artery stenosis, and hyperkalemia. Captopril has a thiol group causing taste "
            "disturbance and proteinuria."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 36",
        "metadata": {"subject": "Pharmacology", "topic": "Antihypertensives", "book": "KD Tripathi", "chapter": "36", "page": "494"},
    },
    {
        "title": "Fluoroquinolones — Spectrum and Adverse Effects",
        "content": (
            "Fluoroquinolones inhibit bacterial DNA gyrase (topoisomerase II) and "
            "topoisomerase IV, preventing DNA supercoiling and replication. Classification: "
            "2nd generation (ciprofloxacin, ofloxacin) — good gram-negative coverage; "
            "3rd generation (levofloxacin) — enhanced gram-positive; 4th generation "
            "(moxifloxacin) — excellent anaerobic coverage. Ciprofloxacin is the drug of "
            "choice for anthrax and typhoid carriers. Adverse effects include tendon rupture "
            "(especially Achilles, more with steroids), QT prolongation, peripheral "
            "neuropathy, CNS effects (seizures, insomnia), and photosensitivity. "
            "Contraindicated in children under 18 (cartilage damage in weight-bearing "
            "joints), pregnancy, and G6PD deficiency. Chelation with antacids, iron, and "
            "calcium reduces absorption."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 49",
        "metadata": {"subject": "Pharmacology", "topic": "Antimicrobials", "book": "KD Tripathi", "chapter": "49", "page": "688"},
    },
    {
        "title": "Digoxin — Pharmacology and Toxicity",
        "content": (
            "Digoxin is a cardiac glycoside that inhibits the Na+/K+-ATPase pump on "
            "myocardial cells, increasing intracellular Na+ which reduces Na+/Ca2+ "
            "exchange activity, leading to increased intracellular Ca2+ and enhanced "
            "contractility (positive inotropic effect). It has a narrow therapeutic index "
            "(0.5-2 ng/mL). Toxicity is exacerbated by hypokalemia (both compete for "
            "the same pump), hypercalcemia, hypomagnesemia, and renal impairment. "
            "ECG features of digoxin effect: reverse-tick ST depression, shortened QT, "
            "T wave inversion. Toxicity signs: arrhythmias (paroxysmal atrial tachycardia "
            "with block is pathognomonic), nausea, vomiting, xanthopsia (yellow vision). "
            "Treatment: digoxin-specific antibodies (Digibind), correct K+, temporary "
            "pacing for bradyarrhythmias. Avoid DC cardioversion in toxicity."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 35",
        "metadata": {"subject": "Pharmacology", "topic": "Cardiac Glycosides", "book": "KD Tripathi", "chapter": "35", "page": "481"},
    },
    {
        "title": "Corticosteroids — Classification and Adverse Effects",
        "content": (
            "Corticosteroids are classified by duration: short-acting (hydrocortisone, "
            "cortisone — t½ 8-12h), intermediate (prednisolone, methylprednisolone, "
            "triamcinolone — t½ 12-36h), long-acting (dexamethasone, betamethasone — "
            "t½ 36-72h). Mineralocorticoid activity: highest in hydrocortisone, absent "
            "in dexamethasone. Cushing syndrome features with chronic use: moon face, "
            "buffalo hump, central obesity, striae, thin skin, easy bruising. "
            "Metabolic: hyperglycemia, osteoporosis, growth suppression in children. "
            "Immunosuppression increases infection risk. Peptic ulcers (especially "
            "with NSAIDs). Adrenal suppression occurs with >2 weeks use — taper required "
            "to avoid adrenal crisis. Dexamethasone suppression test: 1 mg overnight = "
            "screening, 2-day low dose = confirms Cushing's, high dose = differentiates "
            "pituitary from ectopic."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 20",
        "metadata": {"subject": "Pharmacology", "topic": "Corticosteroids", "book": "KD Tripathi", "chapter": "20", "page": "288"},
    },
    {
        "title": "NSAIDs — Mechanism and COX Selectivity",
        "content": (
            "Non-steroidal anti-inflammatory drugs inhibit cyclooxygenase enzymes. "
            "COX-1 is constitutive (gastric mucosa protection, platelet TXA2, renal "
            "blood flow). COX-2 is inducible at sites of inflammation. Non-selective "
            "inhibitors: aspirin (irreversible), ibuprofen, naproxen, diclofenac, "
            "indomethacin, piroxicam. Selective COX-2: celecoxib, etoricoxib. "
            "Aspirin irreversibly acetylates COX-1 in platelets (no nucleus, cannot "
            "resynthesize) — antiplatelet effect lasts 7-10 days (platelet lifespan). "
            "Low-dose aspirin (75-150 mg) for cardiovascular prophylaxis. Reye syndrome "
            "with aspirin in children with viral infections. NSAID adverse effects: "
            "peptic ulcers, renal papillary necrosis (analgesic nephropathy), "
            "bronchospasm in aspirin-sensitive asthma, and cardiovascular risk with "
            "COX-2 inhibitors."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 15",
        "metadata": {"subject": "Pharmacology", "topic": "NSAIDs", "book": "KD Tripathi", "chapter": "15", "page": "199"},
    },
    {
        "title": "Anticoagulants — Heparin and Warfarin",
        "content": (
            "Heparin (unfractionated) potentiates antithrombin III activity 1000-fold, "
            "inhibiting thrombin (IIa), Xa, IXa, XIa, XIIa. Monitored by aPTT. LMWH "
            "(enoxaparin, dalteparin) selectively inhibits factor Xa more than IIa — "
            "better bioavailability, fixed dosing, no monitoring usually needed. "
            "Heparin-induced thrombocytopenia (HIT): type II is immune-mediated (PF4 "
            "antibodies), paradoxically causes thrombosis. Antidote: protamine sulfate. "
            "Warfarin inhibits vitamin K epoxide reductase (VKORC1), blocking "
            "gamma-carboxylation of factors II, VII, IX, X and proteins C & S. "
            "Monitored by PT/INR. Protein C has shortest half-life — initial "
            "hypercoagulable state (warfarin skin necrosis). Drug interactions: "
            "CYP2C9 inducers (rifampin) reduce effect; CYP2C9 inhibitors (fluconazole, "
            "amiodarone) increase effect. Antidote: vitamin K, FFP, PCC."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 44",
        "metadata": {"subject": "Pharmacology", "topic": "Anticoagulants", "book": "KD Tripathi", "chapter": "44", "page": "617"},
    },
    {
        "title": "Antiepileptic Drugs — Mechanisms and Selection",
        "content": (
            "Antiepileptic drugs act via: Na+ channel blockade (phenytoin, carbamazepine, "
            "lamotrigine, valproate), Ca2+ channel blockade (ethosuximide for absence "
            "seizures — T-type channels), GABA enhancement (benzodiazepines at GABA-A, "
            "vigabatrin inhibits GABA-T, tiagabine inhibits GABA reuptake), glutamate "
            "inhibition (felbamate, topiramate). Drug of choice: generalized tonic-clonic "
            "= valproate; absence = ethosuximide/valproate; partial = carbamazepine; "
            "status epilepticus = IV lorazepam → phenytoin → thiopentone. Phenytoin shows "
            "zero-order (saturation) kinetics — small dose changes cause "
            "disproportionate level changes. Valproate is teratogenic (neural tube "
            "defects). Carbamazepine causes SIADH and Stevens-Johnson syndrome "
            "(HLA-B*1502 in Asians)."
        ),
        "source_reference": "KD Tripathi — Essentials of Medical Pharmacology, 8th Ed, Ch 30",
        "metadata": {"subject": "Pharmacology", "topic": "Antiepileptics", "book": "KD Tripathi", "chapter": "30", "page": "409"},
    },
]

PATHOLOGY_CHUNKS = [
    {
        "title": "Cell Injury — Types and Mechanisms",
        "content": (
            "Cell injury occurs when cells are stressed beyond their adaptive capacity. "
            "Reversible injury: cellular swelling (loss of ion homeostasis), fatty change "
            "(hepatic steatosis), membrane blebbing. Irreversible injury markers: "
            "mitochondrial dysfunction (opening of permeability transition pore), "
            "membrane damage (loss of phospholipid asymmetry, activation of lipases), "
            "nuclear changes — pyknosis (condensation), karyorrhexis (fragmentation), "
            "karyolysis (dissolution). Mechanisms: ATP depletion (ischemia), "
            "mitochondrial damage, influx of calcium, oxidative stress (free radicals), "
            "membrane damage, DNA damage. Reperfusion injury occurs when blood flow "
            "is restored — generates reactive oxygen species, complement activation, "
            "and neutrophil infiltration causing additional damage beyond the ischemic "
            "insult."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 2",
        "metadata": {"subject": "Pathology", "topic": "Cell Injury", "book": "Robbins & Cotran", "chapter": "2", "page": "33"},
    },
    {
        "title": "Necrosis — Types and Morphology",
        "content": (
            "Necrosis is unregulated cell death with membrane disruption and inflammation. "
            "Types: Coagulative — most common, ischemic organs (heart, kidney, spleen); "
            "cells retain outline but lose nuclei. Liquefactive — brain infarcts, "
            "abscesses (neutrophilic enzymes); complete dissolution. Caseous — "
            "tuberculosis; amorphous granular debris, no cell outlines; granuloma with "
            "Langhans giant cells. Fat necrosis — acute pancreatitis (lipase release), "
            "breast trauma; chalky white areas (calcium + fatty acids = saponification). "
            "Fibrinoid — vasculitis, malignant hypertension; bright pink homogeneous "
            "material on H&E. Gangrenous — coagulative + superimposed bacterial infection "
            "in lower limbs; wet gangrene has liquefactive component."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 2",
        "metadata": {"subject": "Pathology", "topic": "Cell Injury", "book": "Robbins & Cotran", "chapter": "2", "page": "41"},
    },
    {
        "title": "Apoptosis — Intrinsic and Extrinsic Pathways",
        "content": (
            "Apoptosis is programmed cell death without inflammation. Morphology: cell "
            "shrinkage, chromatin condensation, cytoplasmic blebs, apoptotic bodies "
            "phagocytosed by macrophages. Intrinsic (mitochondrial) pathway: cellular "
            "stress → BH3-only proteins (BAD, BIM) → activate BAX/BAK → mitochondrial "
            "outer membrane pores → cytochrome c release → apoptosome (Apaf-1 + "
            "caspase-9) → executioner caspases (3, 6, 7). Anti-apoptotic: BCL-2, BCL-XL "
            "(overexpressed in follicular lymphoma — t(14;18)). Extrinsic (death receptor) "
            "pathway: FasL/Fas or TNF/TNFR → FADD adaptor → caspase-8 → executioner "
            "caspases. p53 is a key apoptosis inducer (DNA damage → p53 → BAX "
            "upregulation). Defective apoptosis: cancer (BCL-2 overexpression), "
            "autoimmunity (defective Fas). Excessive: neurodegenerative diseases."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 2",
        "metadata": {"subject": "Pathology", "topic": "Cell Injury", "book": "Robbins & Cotran", "chapter": "2", "page": "52"},
    },
    {
        "title": "Acute Inflammation — Vascular Changes and Cellular Events",
        "content": (
            "Acute inflammation has two main components: vascular changes and cellular "
            "events. Vascular: transient arteriolar vasoconstriction → vasodilation "
            "(histamine, NO) → increased blood flow (redness, warmth) → increased "
            "vascular permeability (protein-rich exudate) → stasis. Edema mechanisms: "
            "contraction of endothelial cells (immediate transient, histamine/bradykinin), "
            "direct endothelial injury (immediate sustained, burns/toxins), "
            "leukocyte-dependent injury (delayed). Cellular: margination → rolling "
            "(selectins — P-selectin on endothelium, L-selectin on leukocytes, ligand = "
            "Sialyl-Lewis X) → firm adhesion (integrins — LFA-1, Mac-1 on leukocytes "
            "binding ICAM-1 on endothelium) → transmigration (diapedesis through "
            "endothelial junctions, PECAM-1/CD31) → chemotaxis (C5a, LTB4, IL-8, "
            "bacterial products)."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 3",
        "metadata": {"subject": "Pathology", "topic": "Inflammation", "book": "Robbins & Cotran", "chapter": "3", "page": "73"},
    },
    {
        "title": "Hemodynamic Disorders — Thrombosis and Embolism",
        "content": (
            "Virchow's triad of thrombosis: endothelial injury (most important — exposes "
            "subendothelial collagen, releases tissue factor), abnormal blood flow (stasis "
            "or turbulence — allows platelet contact with wall, prevents dilution of "
            "clotting factors), hypercoagulability (factor V Leiden — most common inherited "
            "cause, prothrombin gene mutation G20210A, antiphospholipid syndrome — most "
            "common acquired). Arterial thrombi: white thrombi, platelet-rich, occur at "
            "sites of turbulence. Venous thrombi: red thrombi, fibrin-rich, form in stasis. "
            "Lines of Zahn: alternating pale (platelets/fibrin) and dark (RBCs) layers — "
            "distinguish antemortem thrombus from postmortem clot. Pulmonary embolism: "
            "most from deep leg veins; saddle embolus straddles bifurcation of pulmonary "
            "artery → sudden death from right heart failure."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 4",
        "metadata": {"subject": "Pathology", "topic": "Hemodynamics", "book": "Robbins & Cotran", "chapter": "4", "page": "117"},
    },
    {
        "title": "Neoplasia — Grading and Staging",
        "content": (
            "Tumor grading assesses the degree of differentiation and mitotic activity "
            "histologically. Grade I: well-differentiated (resembles normal tissue). "
            "Grade II: moderately differentiated. Grade III: poorly differentiated. "
            "Grade IV: anaplastic (undifferentiated). Staging assesses spread and is the "
            "most important prognostic factor. TNM system: T = primary tumor size/extent, "
            "N = regional lymph node involvement, M = distant metastases. Example: breast "
            "cancer T2N1M0 = tumor 2-5 cm, 1-3 axillary nodes, no distant mets. "
            "AJCC stages: I = localized, II = locally advanced, III = regional spread, "
            "IV = distant metastasis. Sentinel lymph node biopsy: first node in drainage "
            "basin — if negative, skip axillary dissection. Staging > grading for "
            "prognosis in most cancers."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 7",
        "metadata": {"subject": "Pathology", "topic": "Neoplasia", "book": "Robbins & Cotran", "chapter": "7", "page": "287"},
    },
    {
        "title": "Tumor Markers — Clinical Applications",
        "content": (
            "Tumor markers aid in monitoring treatment and detecting recurrence (NOT "
            "screening in most cases). AFP: hepatocellular carcinoma, yolk sac tumor; "
            "also elevated in pregnancy, cirrhosis. CEA: colorectal cancer monitoring; "
            "also elevated in smoking, IBD, pancreatitis. CA-125: ovarian cancer; also "
            "elevated in endometriosis, pregnancy, PID. CA 19-9: pancreatic cancer. "
            "PSA: prostate cancer screening (controversial) and monitoring. Beta-hCG: "
            "choriocarcinoma, testicular germ cell tumors. S-100: melanoma, schwannoma. "
            "Chromogranin A: neuroendocrine tumors. Calcitonin: medullary thyroid "
            "carcinoma. LDH: general tumor burden, lymphoma. Her2/neu (c-erbB2): "
            "breast cancer (25%) — trastuzumab target. BRCA1/2: hereditary breast/ovarian "
            "cancer risk (not tumor markers per se, but germline mutations)."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 7",
        "metadata": {"subject": "Pathology", "topic": "Neoplasia", "book": "Robbins & Cotran", "chapter": "7", "page": "323"},
    },
    {
        "title": "Immunopathology — Hypersensitivity Reactions",
        "content": (
            "Type I (immediate/anaphylactic): IgE-mediated mast cell degranulation. "
            "Examples: anaphylaxis, allergic asthma, hay fever. Mediators: histamine, "
            "leukotrienes, prostaglandins. Late phase (4-8h): eosinophils. Type II "
            "(antibody-mediated): IgG/IgM against cell surface antigens. Examples: "
            "autoimmune hemolytic anemia, Goodpasture syndrome (anti-GBM), Graves "
            "disease (stimulatory anti-TSH receptor), myasthenia gravis (anti-AChR). "
            "Type III (immune complex): antigen-antibody complexes deposit in tissues. "
            "Examples: serum sickness (systemic), Arthus reaction (local), SLE "
            "(anti-dsDNA), post-streptococcal GN. Type IV (delayed/cell-mediated): "
            "T-cell mediated, no antibodies. Examples: TB skin test, contact dermatitis, "
            "transplant rejection, Type 1 DM (CD8+ T cells destroy beta cells), "
            "Hashimoto thyroiditis, MS."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 6",
        "metadata": {"subject": "Pathology", "topic": "Immunopathology", "book": "Robbins & Cotran", "chapter": "6", "page": "203"},
    },
    {
        "title": "Amyloidosis — Classification and Diagnosis",
        "content": (
            "Amyloid is misfolded protein deposited extracellularly as insoluble fibrils "
            "with beta-pleated sheet configuration. Staining: Congo red → apple-green "
            "birefringence under polarized light. AL (immunoglobulin light chain): "
            "multiple myeloma, primary amyloidosis; affects heart, kidney, tongue, "
            "nerves. AA (serum amyloid A): chronic inflammatory conditions (RA, IBD, "
            "FMF, chronic infections like TB, osteomyelitis); mainly kidney, liver. "
            "ATTR (transthyretin): senile cardiac amyloidosis (wild-type TTR), familial "
            "amyloid polyneuropathy (mutant TTR). A-beta2M: dialysis-associated. "
            "A-beta: Alzheimer disease (cerebral plaques). Diagnosis: abdominal fat pad "
            "aspiration or rectal biopsy → Congo red staining. Most common cause of "
            "restrictive cardiomyopathy. Nephrotic syndrome is the most common renal "
            "presentation."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 6",
        "metadata": {"subject": "Pathology", "topic": "Immunopathology", "book": "Robbins & Cotran", "chapter": "6", "page": "256"},
    },
    {
        "title": "Anemias — Classification and Diagnosis",
        "content": (
            "Anemias classified by MCV: Microcytic (MCV <80): iron deficiency (most "
            "common worldwide), thalassemia, anemia of chronic disease, sideroblastic "
            "anemia, lead poisoning. Iron deficiency: low ferritin (most sensitive), "
            "high TIBC, low serum iron. Blood smear: hypochromic microcytic with target "
            "cells and pencil cells. Normocytic (MCV 80-100): acute blood loss, anemia "
            "of chronic disease, hemolytic anemias, aplastic anemia. Macrocytic (MCV >100): "
            "B12 deficiency (subacute combined degeneration, hypersegmented neutrophils), "
            "folate deficiency (no neurological symptoms), liver disease, hypothyroidism. "
            "Megaloblastic = impaired DNA synthesis (B12, folate); non-megaloblastic = "
            "liver disease, reticulocytosis. Reticulocyte count: corrected count >2% = "
            "adequate marrow response (hemolysis, blood loss); <2% = underproduction."
        ),
        "source_reference": "Robbins & Cotran — Pathologic Basis of Disease, 10th Ed, Ch 14",
        "metadata": {"subject": "Pathology", "topic": "Hematopathology", "book": "Robbins & Cotran", "chapter": "14", "page": "623"},
    },
]

ANATOMY_CHUNKS = [
    {
        "title": "Brachial Plexus — Formation and Branches",
        "content": (
            "The brachial plexus is formed by anterior rami of C5-T1. Structure: "
            "roots → trunks (upper C5-C6, middle C7, lower C8-T1) → divisions "
            "(anterior/posterior) → cords (lateral, posterior, medial) → terminal "
            "branches. Lateral cord (C5-C7): musculocutaneous nerve, lateral pectoral "
            "nerve, lateral root of median nerve. Medial cord (C8-T1): ulnar nerve, "
            "medial pectoral nerve, medial cutaneous nerves of arm and forearm, medial "
            "root of median nerve. Posterior cord (C5-T1): axillary nerve, radial nerve, "
            "upper and lower subscapular nerves, thoracodorsal nerve. Erb-Duchenne palsy "
            "(C5-C6): waiter's tip position — arm adducted, medially rotated, forearm "
            "pronated. Klumpke palsy (C8-T1): claw hand, intrinsic muscle paralysis, "
            "may have Horner syndrome."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 7",
        "metadata": {"subject": "Anatomy", "topic": "Upper Limb", "book": "Gray's Anatomy", "chapter": "7", "page": "689"},
    },
    {
        "title": "Heart — Blood Supply and Coronary Arteries",
        "content": (
            "Right coronary artery (RCA): arises from right aortic sinus. Supplies: "
            "right atrium, right ventricle, posterior 1/3 of interventricular septum, "
            "SA node (60%), AV node (80%). Branches: marginal artery, posterior "
            "descending artery (in right-dominant circulation — 85% of population). "
            "Left coronary artery (LCA): arises from left aortic sinus, divides into: "
            "LAD (left anterior descending) — supplies anterior 2/3 of septum, anterior "
            "wall of LV, apex; circumflex — supplies lateral and posterior LV, SA node "
            "(40%). LAD occlusion: anterior wall MI — most common. RCA occlusion: "
            "inferior wall MI with possible AV block. Left main occlusion: massive "
            "anterior MI, cardiogenic shock (widow-maker). Coronary dominance determined "
            "by which artery gives the posterior descending artery."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 3",
        "metadata": {"subject": "Anatomy", "topic": "Thorax", "book": "Gray's Anatomy", "chapter": "3", "page": "201"},
    },
    {
        "title": "Cranial Nerves — Functions and Clinical Testing",
        "content": (
            "CN I (Olfactory): smell — test each nostril separately. CN II (Optic): "
            "vision, visual fields, pupillary light reflex (afferent limb). CN III "
            "(Oculomotor): superior/inferior/medial rectus, inferior oblique, levator "
            "palpebrae, pupil constriction (parasympathetic). Palsy: ptosis, eye 'down "
            "and out', dilated pupil. CN IV (Trochlear): superior oblique (intorsion, "
            "depression in adducted eye). Longest intracranial course, only CN to exit "
            "dorsally. CN V (Trigeminal): V1 ophthalmic, V2 maxillary, V3 mandibular; "
            "facial sensation, muscles of mastication (masseter, temporalis, pterygoids). "
            "CN VI (Abducens): lateral rectus. CN VII (Facial): muscles of facial "
            "expression, taste anterior 2/3 tongue, submandibular/sublingual glands, "
            "stapedius. UMN lesion: forehead spared; LMN: entire half-face paralyzed."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 8",
        "metadata": {"subject": "Anatomy", "topic": "Head and Neck", "book": "Gray's Anatomy", "chapter": "8", "page": "819"},
    },
    {
        "title": "Inguinal Canal — Anatomy and Hernias",
        "content": (
            "The inguinal canal is an oblique passage 4 cm long in the anterior abdominal "
            "wall. Boundaries: anterior wall = external oblique aponeurosis (full length) + "
            "internal oblique (lateral 1/3); posterior wall (floor) = transversalis fascia "
            "(full length) + conjoint tendon (medial 1/3); roof = internal oblique + "
            "transversus abdominis arching fibers; inferior wall = inguinal ligament. "
            "Deep ring: transversalis fascia, lateral to inferior epigastric vessels. "
            "Superficial ring: external oblique aponeurosis. Contents in males: spermatic "
            "cord (vas deferens, testicular artery, pampiniform plexus, cremasteric "
            "artery, genital branch of genitofemoral nerve, ilioinguinal nerve). "
            "Indirect hernia: enters deep ring, lateral to inferior epigastric; "
            "congenital (patent processus vaginalis), most common in young males. "
            "Direct hernia: through Hesselbach triangle, medial to inferior epigastric; "
            "acquired, older males."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 4",
        "metadata": {"subject": "Anatomy", "topic": "Abdomen", "book": "Gray's Anatomy", "chapter": "4", "page": "325"},
    },
    {
        "title": "Circle of Willis — Cerebral Blood Supply",
        "content": (
            "The circle of Willis is an arterial anastomosis at the base of the brain. "
            "Components: anterior cerebral arteries (ACA) connected by anterior "
            "communicating artery (AComm), internal carotid arteries (ICA), posterior "
            "communicating arteries (PComm) connecting ICA to posterior cerebral arteries "
            "(PCA), which arise from basilar artery. Vertebral arteries unite to form "
            "basilar artery at pontomedullary junction. ACA supplies medial surface of "
            "frontal and parietal lobes (leg area of motor/sensory cortex). MCA supplies "
            "lateral surface (face and arm areas) — most common stroke territory. PCA "
            "supplies occipital lobe, inferior temporal lobe. AComm aneurysm: most common "
            "site of berry aneurysm (40%). MCA stroke: contralateral face/arm weakness, "
            "aphasia (dominant hemisphere). ACA stroke: contralateral leg weakness."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 8",
        "metadata": {"subject": "Anatomy", "topic": "Neuroanatomy", "book": "Gray's Anatomy", "chapter": "8", "page": "856"},
    },
    {
        "title": "Thyroid Gland — Surgical Anatomy",
        "content": (
            "The thyroid gland lies at C5-T1 level, enclosed by pretracheal fascia. "
            "Two lobes connected by isthmus at tracheal rings 2-4. Arterial supply: "
            "superior thyroid artery (first branch of external carotid, with external "
            "laryngeal nerve), inferior thyroid artery (thyrocervical trunk of subclavian, "
            "with recurrent laryngeal nerve). Thyroidea ima artery (10%): from brachiocephalic "
            "or aortic arch — important during tracheostomy. Venous drainage: superior and "
            "middle thyroid veins → IJV; inferior thyroid veins → brachiocephalic veins. "
            "Recurrent laryngeal nerve: runs in tracheoesophageal groove; at risk during "
            "thyroid surgery, especially near Berry's ligament. Damage → hoarseness "
            "(unilateral), stridor/aphonia (bilateral). External laryngeal nerve: runs "
            "with superior thyroid artery; damage → loss of pitch ('Voice of God')."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 8",
        "metadata": {"subject": "Anatomy", "topic": "Head and Neck", "book": "Gray's Anatomy", "chapter": "8", "page": "780"},
    },
    {
        "title": "Knee Joint — Ligaments and Menisci",
        "content": (
            "The knee is a modified hinge synovial joint. Ligaments: ACL (anterior "
            "cruciate) — prevents anterior displacement of tibia, tested by anterior "
            "drawer test and Lachman test; PCL (posterior cruciate) — prevents posterior "
            "displacement, tested by posterior drawer test and sag sign; MCL (medial "
            "collateral) — resists valgus stress, attached to medial meniscus; LCL "
            "(lateral collateral) — resists varus stress, NOT attached to lateral "
            "meniscus. Unhappy triad (O'Donoghue): ACL tear + MCL tear + medial "
            "meniscus tear — valgus force with lateral rotation. Medial meniscus: "
            "C-shaped, more fixed (more commonly injured). Lateral meniscus: O-shaped, "
            "more mobile. Menisci are avascular in inner 2/3 (white zone — poor "
            "healing), vascular in outer 1/3 (red zone — can heal). McMurray test: "
            "meniscal tears."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 6",
        "metadata": {"subject": "Anatomy", "topic": "Lower Limb", "book": "Gray's Anatomy", "chapter": "6", "page": "556"},
    },
    {
        "title": "Liver — Segmental Anatomy and Portal Triad",
        "content": (
            "Couinaud classification divides liver into 8 functionally independent "
            "segments based on hepatic vein and portal triad distribution. Each segment "
            "has its own portal pedicle (portal vein, hepatic artery, bile duct) and "
            "hepatic venous drainage. The portal triad (Glisson's capsule) contains: "
            "portal vein (75% of blood supply, nutrient-rich), hepatic artery (25%, "
            "oxygen-rich), and bile duct. Caudate lobe (segment I) is unique — receives "
            "blood from both right and left portal branches and drains directly into IVC "
            "(not via hepatic veins) — hypertrophies in Budd-Chiari syndrome. "
            "Falciform ligament separates anatomical right and left lobes. Cantlie's "
            "line (gallbladder fossa to IVC) separates functional right and left lobes. "
            "Pringle maneuver: clamping hepatoduodenal ligament (portal triad) to "
            "control hepatic hemorrhage."
        ),
        "source_reference": "Gray's Anatomy for Students, 4th Ed, Ch 4",
        "metadata": {"subject": "Anatomy", "topic": "Abdomen", "book": "Gray's Anatomy", "chapter": "4", "page": "371"},
    },
]

PHYSIOLOGY_CHUNKS = [
    {
        "title": "Cardiac Cycle — Pressure-Volume Relationships",
        "content": (
            "The cardiac cycle has 4 phases: isovolumetric contraction (all valves closed, "
            "pressure rises from 8 to 80 mmHg), rapid ejection (aortic valve opens at "
            "80 mmHg, blood expelled), isovolumetric relaxation (all valves closed, "
            "pressure falls), rapid filling (mitral valve opens, passive filling). "
            "End-diastolic volume (EDV) ~120 mL, end-systolic volume (ESV) ~50 mL, "
            "stroke volume = EDV - ESV = 70 mL, ejection fraction = SV/EDV = ~58%. "
            "Frank-Starling mechanism: increased EDV stretches sarcomeres → increased "
            "force of contraction (increased SV). Operates on ascending limb of "
            "length-tension curve. A-V valve closure → S1 heart sound (louder, longer); "
            "semilunar valve closure → S2 (aortic component before pulmonic — A2P2). "
            "S3 = rapid ventricular filling (normal in young, pathological in old = "
            "volume overload). S4 = atrial kick against stiff ventricle (always "
            "pathological — ventricular hypertrophy)."
        ),
        "source_reference": "Guyton & Hall — Textbook of Medical Physiology, 14th Ed, Ch 9",
        "metadata": {"subject": "Physiology", "topic": "Cardiovascular Physiology", "book": "Guyton & Hall", "chapter": "9", "page": "109"},
    },
    {
        "title": "Renal Physiology — Glomerular Filtration",
        "content": (
            "GFR = Kf × net filtration pressure. Normal GFR ≈ 125 mL/min or 180 L/day. "
            "Net filtration pressure = (Pgc - Pbs) - (πgc - πbs) = (60 - 18) - (32 - 0) "
            "= 10 mmHg. Pgc = glomerular capillary hydrostatic pressure (favors "
            "filtration). πgc = glomerular oncotic pressure (opposes, increases along "
            "capillary as water is filtered out → filtration equilibrium). Afferent "
            "arteriolar constriction: decreases both RBF and GFR. Efferent constriction: "
            "decreases RBF but increases GFR (up to a point). Filtration fraction = "
            "GFR/RPF ≈ 20%. Inulin clearance = gold standard GFR measurement (freely "
            "filtered, not reabsorbed or secreted). Creatinine clearance overestimates "
            "GFR slightly (some tubular secretion). PAH clearance = effective RPF "
            "(fully extracted in one pass). Autoregulation: myogenic mechanism + "
            "tubuloglomerular feedback (macula densa) maintain GFR at MAP 80-180 mmHg."
        ),
        "source_reference": "Guyton & Hall — Textbook of Medical Physiology, 14th Ed, Ch 27",
        "metadata": {"subject": "Physiology", "topic": "Renal Physiology", "book": "Guyton & Hall", "chapter": "27", "page": "331"},
    },
    {
        "title": "Respiratory Physiology — Gas Exchange",
        "content": (
            "Oxygen transport: 98.5% bound to hemoglobin, 1.5% dissolved (determines "
            "PaO2). Oxygen-hemoglobin dissociation curve: sigmoid shape due to cooperative "
            "binding. P50 = PO2 at 50% saturation = 26.6 mmHg. Right shift (decreased "
            "affinity, easier unloading): increased temperature, increased 2,3-DPG, "
            "increased CO2, decreased pH (Bohr effect). Left shift: opposite conditions, "
            "fetal hemoglobin (HbF), CO poisoning, methemoglobin. Carbon dioxide "
            "transport: 70% as bicarbonate (carbonic anhydrase in RBCs), 23% carbamino "
            "compounds (bound to globin), 7% dissolved. Chloride shift: Cl- enters RBCs "
            "as HCO3- exits (maintains electroneutrality). Haldane effect: deoxygenated "
            "hemoglobin carries more CO2 than oxygenated hemoglobin. V/Q matching: apex "
            "V/Q = 3.3 (wasted ventilation), base V/Q = 0.6 (relative shunt). Dead "
            "space ventilation: V/Q → infinity. Shunt: V/Q = 0."
        ),
        "source_reference": "Guyton & Hall — Textbook of Medical Physiology, 14th Ed, Ch 40",
        "metadata": {"subject": "Physiology", "topic": "Respiratory Physiology", "book": "Guyton & Hall", "chapter": "40", "page": "517"},
    },
    {
        "title": "Endocrine — Thyroid Hormone Physiology",
        "content": (
            "Thyroid hormone synthesis: iodide trapping (NIS symporter at basolateral "
            "membrane) → oxidation (thyroid peroxidase, TPO) → organification (iodination "
            "of tyrosine residues on thyroglobulin → MIT, DIT) → coupling (2 DIT = T4, "
            "1 MIT + 1 DIT = T3) → pinocytosis of colloid → lysosomal proteolysis → "
            "release of T4 (90%) and T3 (10%). T4 → T3 conversion peripherally by "
            "deiodinase type 1 and 2 (T3 is 4x more active). Type 3 deiodinase converts "
            "T4 → reverse T3 (inactive). Protein binding: 70% TBG, 20% albumin, 10% "
            "TBPA. Only free T4/T3 are biologically active. TSH stimulates all steps. "
            "Wolff-Chaikoff effect: excess iodide transiently inhibits organification. "
            "Jod-Basedow: iodide excess → hyperthyroidism in autonomous thyroid. "
            "Propylthiouracil (PTU): blocks TPO + peripheral conversion. Methimazole: "
            "blocks TPO only (preferred except 1st trimester pregnancy)."
        ),
        "source_reference": "Guyton & Hall — Textbook of Medical Physiology, 14th Ed, Ch 77",
        "metadata": {"subject": "Physiology", "topic": "Endocrine Physiology", "book": "Guyton & Hall", "chapter": "77", "page": "951"},
    },
    {
        "title": "Neurophysiology — Action Potential",
        "content": (
            "Resting membrane potential: -70 mV (mainly due to K+ leak channels and "
            "Na+/K+-ATPase). Action potential phases: 0 = rapid depolarization (voltage-"
            "gated Na+ channels open, Na+ influx); 1 = initial repolarization (Na+ "
            "channels inactivate, transient K+ efflux); 2 = plateau (Ca2+ influx via "
            "L-type Ca channels, balanced by K+ efflux — important in cardiac muscle); "
            "3 = repolarization (delayed rectifier K+ channels open, Ca2+ channels "
            "close); 4 = resting potential (Na+/K+-ATPase restores ionic gradients). "
            "Absolute refractory period: Na+ channels inactivated, no stimulus can "
            "generate AP. Relative refractory period: some Na+ channels recovered, "
            "stronger stimulus needed. Conduction velocity increases with: myelination "
            "(saltatory conduction at nodes of Ranvier), increased fiber diameter, "
            "increased temperature. Nernst equation: Eion = (61/z) × log([ion]out/"
            "[ion]in). Goldman equation: combines all ions for Vm."
        ),
        "source_reference": "Guyton & Hall — Textbook of Medical Physiology, 14th Ed, Ch 5",
        "metadata": {"subject": "Physiology", "topic": "Neurophysiology", "book": "Guyton & Hall", "chapter": "5", "page": "63"},
    },
    {
        "title": "GI Physiology — Gastric Acid Secretion",
        "content": (
            "Parietal cells secrete HCl via H+/K+-ATPase (proton pump) at apical "
            "membrane. Stimulants: acetylcholine (M3 muscarinic → Gq → IP3/Ca2+), "
            "gastrin (CCK-B receptor → Gq → IP3/Ca2+), histamine (H2 receptor → Gs → "
            "cAMP — most potent). Cephalic phase (30%): vagal stimulation, ACh. Gastric "
            "phase (60%): distension and peptides stimulate gastrin release from G cells. "
            "Intestinal phase (10%): amino acids in duodenum. Inhibitors: somatostatin "
            "(from D cells — paracrine inhibition of G cells and parietal cells), "
            "secretin (from S cells in duodenum — inhibits gastrin), GIP, prostaglandins "
            "(PGE2 → Gi → reduces cAMP). PPIs (omeprazole) irreversibly block H+/K+-"
            "ATPase — most effective acid suppressors. H2 blockers (ranitidine) block "
            "histamine receptor. Zollinger-Ellison syndrome: gastrinoma → massive HCl "
            "secretion → recurrent peptic ulcers."
        ),
        "source_reference": "Guyton & Hall — Textbook of Medical Physiology, 14th Ed, Ch 64",
        "metadata": {"subject": "Physiology", "topic": "GI Physiology", "book": "Guyton & Hall", "chapter": "64", "page": "801"},
    },
    {
        "title": "Hematology — Coagulation Cascade",
        "content": (
            "Coagulation cascade: Intrinsic pathway (XII → XI → IX + VIII → X): "
            "activated by contact with subendothelial collagen/glass. Measured by aPTT. "
            "Extrinsic pathway (tissue factor + VII → X): activated by tissue factor "
            "from damaged cells. Measured by PT/INR. Common pathway (X + V → prothrombin "
            "(II) → thrombin → fibrinogen (I) → fibrin → XIII crosslinks). Thrombin "
            "positive feedback: activates V, VIII, XI, platelets. Anticoagulant systems: "
            "antithrombin III (heparin cofactor — inactivates thrombin, Xa, IXa); "
            "protein C + protein S (inactivate Va, VIIIa — vitamin K-dependent); "
            "tissue factor pathway inhibitor (TFPI — blocks VIIa-TF-Xa complex). "
            "Fibrinolysis: plasminogen → plasmin (by tPA) → degrades fibrin → D-dimers "
            "(marker of fibrinolysis, elevated in DIC, PE, DVT). DIC: widespread "
            "coagulation → consumption of factors → bleeding. Lab: prolonged PT, aPTT, "
            "low fibrinogen, elevated D-dimer, thrombocytopenia, schistocytes."
        ),
        "source_reference": "Guyton & Hall — Textbook of Medical Physiology, 14th Ed, Ch 37",
        "metadata": {"subject": "Physiology", "topic": "Hematology", "book": "Guyton & Hall", "chapter": "37", "page": "467"},
    },
]

MEDICINE_CHUNKS = [
    {
        "title": "Diabetes Mellitus — Classification and Diagnosis",
        "content": (
            "Type 1 DM: autoimmune destruction of beta cells (anti-GAD, anti-IA2, "
            "anti-insulin antibodies). HLA-DR3/DR4 associated. Usually young, lean, "
            "insulin-dependent. Presents with polyuria, polydipsia, polyphagia, weight "
            "loss, diabetic ketoacidosis. Type 2 DM: insulin resistance + relative "
            "insulin deficiency. Strong genetic component, obesity-associated. Gradually "
            "progressive — often diagnosed late. Diagnosis criteria (any one of): "
            "fasting glucose ≥126 mg/dL (7.0 mmol/L), 2-hour OGTT ≥200 mg/dL "
            "(11.1 mmol/L), HbA1c ≥6.5%, random glucose ≥200 + symptoms. Pre-diabetes: "
            "fasting 100-125 (IFG), 2h OGTT 140-199 (IGT), HbA1c 5.7-6.4%. HbA1c "
            "reflects average glucose over 2-3 months (RBC lifespan). Target HbA1c <7% "
            "for most adults. Microvascular complications: retinopathy, nephropathy, "
            "neuropathy. Macrovascular: CAD, CVA, PVD."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 402",
        "metadata": {"subject": "Medicine", "topic": "Endocrinology", "book": "Harrison's", "chapter": "402", "page": "2857"},
    },
    {
        "title": "Myocardial Infarction — Diagnosis and Management",
        "content": (
            "Acute MI defined by rise/fall of cardiac troponin (>99th percentile URL) "
            "with at least one of: ischemic symptoms, new ST changes or LBBB, "
            "pathological Q waves, imaging evidence of new wall motion abnormality. "
            "STEMI: ST elevation ≥1 mm in 2 contiguous leads (≥2 mm in V1-V3). "
            "Treatment: MONA (morphine, oxygen if SpO2<90%, nitrates, aspirin 325 mg) + "
            "primary PCI within 90 minutes (door-to-balloon) or fibrinolysis within "
            "30 minutes if PCI unavailable. Antiplatelet: aspirin + P2Y12 inhibitor "
            "(ticagrelor/prasugrel for PCI, clopidogrel for fibrinolysis). "
            "Anticoagulant: heparin. Post-MI: ACE inhibitor (within 24h if LV "
            "dysfunction), beta-blocker, high-dose statin, dual antiplatelet therapy "
            "for 12 months. Complications by timeline: arrhythmia (immediate), "
            "papillary muscle rupture/free wall rupture (3-7 days), Dressler syndrome "
            "(2-10 weeks, autoimmune pericarditis), ventricular aneurysm (weeks-months)."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 272",
        "metadata": {"subject": "Medicine", "topic": "Cardiology", "book": "Harrison's", "chapter": "272", "page": "1882"},
    },
    {
        "title": "Chronic Kidney Disease — Stages and Management",
        "content": (
            "CKD staged by GFR: Stage 1 (≥90, kidney damage markers present), Stage 2 "
            "(60-89, mild decrease), Stage 3a (45-59), Stage 3b (30-44), Stage 4 "
            "(15-29, severe), Stage 5 (<15, kidney failure/ESRD). Most common causes: "
            "diabetes (45%), hypertension (27%), glomerulonephritis (10%). Complications: "
            "anemia (decreased erythropoietin — treat with ESA when Hb <10), "
            "secondary hyperparathyroidism (hyperphosphatemia → low vitamin D → low Ca2+ "
            "→ high PTH → renal osteodystrophy), metabolic acidosis (decreased NH4+ "
            "excretion), hyperkalemia, uremic symptoms (nausea, pericarditis, "
            "encephalopathy, platelet dysfunction). Management: ACE inhibitor/ARB for "
            "proteinuria, SGLT2 inhibitors (dapagliflozin — DAPA-CKD trial), BP <130/80, "
            "phosphate binders, active vitamin D, EPO. Dialysis when symptomatic uremia, "
            "refractory hyperkalemia, fluid overload, or GFR <10."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 311",
        "metadata": {"subject": "Medicine", "topic": "Nephrology", "book": "Harrison's", "chapter": "311", "page": "2188"},
    },
    {
        "title": "Pneumonia — Community-Acquired Classification",
        "content": (
            "CAP (community-acquired pneumonia) is classified by clinical setting. "
            "Typical pneumonia: sudden onset, productive cough, lobar consolidation. "
            "Most common: Streptococcus pneumoniae (overall most common in all ages), "
            "Staphylococcus aureus (post-influenza, IV drug users), Klebsiella "
            "(alcoholics, currant-jelly sputum, upper lobe cavitation). Atypical "
            "pneumonia: gradual onset, dry cough, diffuse interstitial pattern. Agents: "
            "Mycoplasma pneumoniae (young adults, cold agglutinins, bullous myringitis), "
            "Chlamydophila pneumoniae, Legionella (contaminated water, hyponatremia, "
            "diarrhea). Severity assessment: CURB-65 (Confusion, Uremia >44, RR ≥30, "
            "BP <90/60, age ≥65) — score ≥2 consider hospital admission, ≥3 ICU. "
            "Treatment: outpatient = amoxicillin or macrolide; inpatient = beta-lactam + "
            "macrolide or respiratory fluoroquinolone; ICU = beta-lactam + macrolide ± "
            "consider anti-pseudomonal if risk factors."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 128",
        "metadata": {"subject": "Medicine", "topic": "Pulmonology", "book": "Harrison's", "chapter": "128", "page": "905"},
    },
    {
        "title": "Hepatitis B — Serology and Natural History",
        "content": (
            "HBV serology interpretation: HBsAg = active infection (acute or chronic); "
            "Anti-HBs = immunity (vaccination or resolved infection); Anti-HBc IgM = "
            "acute infection; Anti-HBc IgG = past or chronic infection; HBeAg = high "
            "infectivity, active viral replication; Anti-HBe = low replication. Window "
            "period: HBsAg cleared but anti-HBs not yet positive — only anti-HBc IgM "
            "positive (can miss diagnosis if only testing HBsAg and anti-HBs). "
            "Vaccination pattern: anti-HBs positive ONLY. Natural history: 90% adults "
            "resolve acute infection; 90% neonates become chronic (immature immune "
            "system). Chronic HBV: 25% develop cirrhosis, 5% HCC. HBV is a DNA virus "
            "but uses reverse transcriptase (target of tenofovir, entecavir). "
            "Hepatitis D requires HBV coinfection (defective RNA virus needs HBsAg "
            "coat). Coinfection: acute + acute. Superinfection: acute D on chronic B "
            "(worse prognosis)."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 339",
        "metadata": {"subject": "Medicine", "topic": "Gastroenterology", "book": "Harrison's", "chapter": "339", "page": "2367"},
    },
    {
        "title": "Systemic Lupus Erythematosus — Criteria and Management",
        "content": (
            "SLE is a chronic autoimmune disease with multiorgan involvement. 2019 "
            "EULAR/ACR classification: entry criterion = ANA ≥1:80; then additive "
            "criteria scored across clinical (constitutional, hematologic, neuropsychiatric, "
            "mucocutaneous, serosal, musculoskeletal, renal) and immunologic (anti-dsDNA, "
            "anti-Smith, antiphospholipid, complement, direct Coombs) domains. Score ≥10 "
            "= classified as SLE. Pathognomonic antibodies: anti-dsDNA (correlates with "
            "nephritis activity), anti-Smith (most specific). Drug-induced lupus: "
            "hydralazine, procainamide, isoniazid — anti-histone antibodies, no renal/CNS, "
            "resolves on stopping drug. Lupus nephritis: WHO class III-IV (diffuse "
            "proliferative) worst prognosis — treat with cyclophosphamide or "
            "mycophenolate + steroids. Wire-loop lesion on biopsy. Management: "
            "hydroxychloroquine for ALL SLE patients (reduces flares, improves survival), "
            "steroids for acute flares, immunosuppressants for organ-threatening disease."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 357",
        "metadata": {"subject": "Medicine", "topic": "Rheumatology", "book": "Harrison's", "chapter": "357", "page": "2519"},
    },
    {
        "title": "Thyroid Disorders — Hyperthyroidism Differential",
        "content": (
            "Causes of hyperthyroidism: Graves disease (most common — diffuse goiter, "
            "TSH receptor stimulating antibodies (TRAb), exophthalmos, pretibial "
            "myxedema, thyroid acropachy), toxic multinodular goiter (elderly, irregular "
            "goiter), toxic adenoma (single hot nodule, suppresses rest of gland), "
            "subacute thyroiditis (de Quervain — tender, elevated ESR, self-limiting, "
            "viral), postpartum thyroiditis, amiodarone-induced. Diagnosis: low TSH, "
            "high free T4/T3. RAIU scan: diffuse uptake (Graves), multiple hot nodules "
            "(toxic MNG), single hot nodule (adenoma), low/absent uptake (thyroiditis, "
            "exogenous T4, struma ovarii). Thyroid storm: fever >40°C, tachycardia, "
            "altered mental status — treat with PTU (blocks synthesis + peripheral "
            "conversion), propranolol (symptomatic), iodide (after PTU — blocks release, "
            "Wolff-Chaikoff), hydrocortisone (prevents adrenal crisis, blocks T4→T3)."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 381",
        "metadata": {"subject": "Medicine", "topic": "Endocrinology", "book": "Harrison's", "chapter": "381", "page": "2700"},
    },
    {
        "title": "Heart Failure — Classification and Treatment",
        "content": (
            "Heart failure classification: HFrEF (EF ≤40%), HFmrEF (EF 41-49%), "
            "HFpEF (EF ≥50%). NYHA functional class: I = no limitation, II = slight "
            "limitation (comfortable at rest, symptoms with ordinary activity), III = "
            "marked limitation (comfortable at rest, symptoms with less than ordinary "
            "activity), IV = symptoms at rest. ACC/AHA stages: A = at risk, B = "
            "structural disease without symptoms, C = structural + symptoms, D = "
            "refractory. HFrEF treatment ('four pillars' reducing mortality): ACE "
            "inhibitor or ARNI (sacubitril/valsartan, PARADIGM-HF), beta-blocker "
            "(carvedilol, metoprolol succinate, bisoprolol — start low, go slow), "
            "mineralocorticoid antagonist (spironolactone, RALES; eplerenone, EMPHASIS-HF), "
            "SGLT2 inhibitor (dapagliflozin, DAPA-HF; empagliflozin, EMPEROR-Reduced). "
            "Diuretics for congestion (furosemide — symptom relief, no mortality benefit). "
            "ICD for EF ≤35% (primary prevention of sudden death). CRT if EF ≤35% + "
            "LBBB + QRS ≥150 ms."
        ),
        "source_reference": "Harrison's Principles of Internal Medicine, 21st Ed, Ch 257",
        "metadata": {"subject": "Medicine", "topic": "Cardiology", "book": "Harrison's", "chapter": "257", "page": "1773"},
    },
]

ALL_CONTENT_BY_SUBJECT = {
    "Pharmacology": PHARMACOLOGY_CHUNKS,
    "Pathology": PATHOLOGY_CHUNKS,
    "Anatomy": ANATOMY_CHUNKS,
    "Physiology": PHYSIOLOGY_CHUNKS,
    "Medicine": MEDICINE_CHUNKS,
}


# ---------------------------------------------------------------------------
# Knowledge graph entities
# ---------------------------------------------------------------------------

ENTITIES = [
    # Diseases / Conditions
    ("disease", "Type 2 Diabetes Mellitus", ["T2DM", "NIDDM"], {"icd10": "E11", "prevalence": "high"}),
    ("disease", "Type 1 Diabetes Mellitus", ["T1DM", "IDDM"], {"icd10": "E10"}),
    ("disease", "Hypertension", ["HTN", "High Blood Pressure"], {"icd10": "I10"}),
    ("disease", "Myocardial Infarction", ["MI", "Heart Attack"], {"icd10": "I21"}),
    ("disease", "Heart Failure", ["CHF", "Congestive Heart Failure"], {"icd10": "I50"}),
    ("disease", "Chronic Kidney Disease", ["CKD", "Chronic Renal Failure"], {"icd10": "N18"}),
    ("disease", "Pneumonia", ["CAP", "Community-Acquired Pneumonia"], {"icd10": "J18"}),
    ("disease", "Systemic Lupus Erythematosus", ["SLE", "Lupus"], {"icd10": "M32"}),
    ("disease", "Graves Disease", ["Diffuse Toxic Goiter"], {"icd10": "E05.0"}),
    ("disease", "Pulmonary Embolism", ["PE"], {"icd10": "I26"}),
    ("disease", "Epilepsy", ["Seizure Disorder"], {"icd10": "G40"}),
    ("disease", "Iron Deficiency Anemia", ["IDA"], {"icd10": "D50"}),
    ("disease", "Hepatitis B", ["HBV Infection"], {"icd10": "B18.1"}),
    ("disease", "Deep Vein Thrombosis", ["DVT"], {"icd10": "I82"}),
    ("disease", "Diabetic Ketoacidosis", ["DKA"], {"icd10": "E10.1"}),
    # Drugs
    ("drug", "Metformin", ["Glucophage"], {"class": "Biguanide", "route": "oral"}),
    ("drug", "Glibenclamide", ["Glyburide"], {"class": "Sulfonylurea", "route": "oral"}),
    ("drug", "Enalapril", ["Vasotec"], {"class": "ACE Inhibitor", "route": "oral"}),
    ("drug", "Atenolol", ["Tenormin"], {"class": "Beta-Blocker", "route": "oral"}),
    ("drug", "Propranolol", ["Inderal"], {"class": "Beta-Blocker", "route": "oral"}),
    ("drug", "Ciprofloxacin", ["Cipro"], {"class": "Fluoroquinolone", "route": "oral/IV"}),
    ("drug", "Digoxin", ["Lanoxin"], {"class": "Cardiac Glycoside", "route": "oral/IV"}),
    ("drug", "Warfarin", ["Coumadin"], {"class": "Anticoagulant", "route": "oral"}),
    ("drug", "Heparin", ["UFH"], {"class": "Anticoagulant", "route": "IV/SC"}),
    ("drug", "Aspirin", ["ASA", "Acetylsalicylic Acid"], {"class": "NSAID", "route": "oral"}),
    ("drug", "Phenytoin", ["Dilantin"], {"class": "Antiepileptic", "route": "oral/IV"}),
    ("drug", "Prednisolone", ["Deltacortril"], {"class": "Corticosteroid", "route": "oral"}),
    ("drug", "Omeprazole", ["Prilosec"], {"class": "PPI", "route": "oral"}),
    ("drug", "Hydroxychloroquine", ["Plaquenil"], {"class": "DMARD", "route": "oral"}),
    ("drug", "Dapagliflozin", ["Farxiga"], {"class": "SGLT2 Inhibitor", "route": "oral"}),
    # Symptoms
    ("symptom", "Polyuria", [], {"system": "renal"}),
    ("symptom", "Chest Pain", ["Angina"], {"system": "cardiovascular"}),
    ("symptom", "Dyspnea", ["Shortness of Breath", "SOB"], {"system": "respiratory"}),
    ("symptom", "Hemoptysis", ["Coughing Blood"], {"system": "respiratory"}),
    ("symptom", "Jaundice", ["Icterus"], {"system": "hepatobiliary"}),
    ("symptom", "Hematuria", [], {"system": "renal"}),
    ("symptom", "Butterfly Rash", ["Malar Rash"], {"system": "dermatologic"}),
    ("symptom", "Exophthalmos", ["Proptosis"], {"system": "ophthalmologic"}),
    # Investigations
    ("investigation", "HbA1c", ["Glycated Hemoglobin"], {"type": "blood_test"}),
    ("investigation", "Troponin", ["Cardiac Troponin I/T"], {"type": "blood_test"}),
    ("investigation", "INR", ["International Normalized Ratio"], {"type": "blood_test"}),
    ("investigation", "ECG", ["Electrocardiogram", "EKG"], {"type": "procedure"}),
    ("investigation", "Echocardiography", ["Echo", "2D Echo"], {"type": "imaging"}),
    ("investigation", "GFR", ["Glomerular Filtration Rate"], {"type": "calculated"}),
    ("investigation", "RAIU Scan", ["Radioactive Iodine Uptake"], {"type": "nuclear"}),
    ("investigation", "PT/INR", ["Prothrombin Time"], {"type": "blood_test"}),
    ("investigation", "aPTT", ["Activated Partial Thromboplastin Time"], {"type": "blood_test"}),
    ("investigation", "ANA", ["Antinuclear Antibody"], {"type": "blood_test"}),
    # Procedures
    ("procedure", "PCI", ["Percutaneous Coronary Intervention", "Angioplasty"], {}),
    ("procedure", "Thyroidectomy", [], {}),
    ("procedure", "Dialysis", ["Hemodialysis", "Peritoneal Dialysis"], {}),
]

# (source_name, target_name, relationship_type, properties)
RELATIONSHIPS = [
    # Drug → Disease (treatment)
    ("Metformin", "Type 2 Diabetes Mellitus", "indicated_for", {"first_line": True}),
    ("Glibenclamide", "Type 2 Diabetes Mellitus", "indicated_for", {"first_line": False}),
    ("Enalapril", "Hypertension", "indicated_for", {"first_line": True}),
    ("Enalapril", "Heart Failure", "indicated_for", {"evidence": "CONSENSUS, SOLVD"}),
    ("Enalapril", "Chronic Kidney Disease", "indicated_for", {"evidence": "HOPE trial"}),
    ("Atenolol", "Hypertension", "indicated_for", {}),
    ("Propranolol", "Hypertension", "indicated_for", {}),
    ("Ciprofloxacin", "Pneumonia", "indicated_for", {"note": "not first-line for CAP"}),
    ("Digoxin", "Heart Failure", "indicated_for", {"note": "symptom relief, no mortality benefit"}),
    ("Warfarin", "Deep Vein Thrombosis", "indicated_for", {}),
    ("Warfarin", "Pulmonary Embolism", "indicated_for", {}),
    ("Heparin", "Pulmonary Embolism", "indicated_for", {"note": "acute treatment"}),
    ("Heparin", "Deep Vein Thrombosis", "indicated_for", {"note": "acute treatment"}),
    ("Aspirin", "Myocardial Infarction", "indicated_for", {"note": "acute + prophylaxis"}),
    ("Phenytoin", "Epilepsy", "indicated_for", {}),
    ("Prednisolone", "Systemic Lupus Erythematosus", "indicated_for", {"note": "acute flares"}),
    ("Hydroxychloroquine", "Systemic Lupus Erythematosus", "indicated_for", {"note": "all SLE patients"}),
    ("Omeprazole", "Type 2 Diabetes Mellitus", "contraindicated_in", {}),
    ("Dapagliflozin", "Heart Failure", "indicated_for", {"evidence": "DAPA-HF"}),
    ("Dapagliflozin", "Chronic Kidney Disease", "indicated_for", {"evidence": "DAPA-CKD"}),
    ("Dapagliflozin", "Type 2 Diabetes Mellitus", "indicated_for", {}),
    # Disease → Symptom
    ("Type 2 Diabetes Mellitus", "Polyuria", "has_symptom", {}),
    ("Type 1 Diabetes Mellitus", "Polyuria", "has_symptom", {}),
    ("Myocardial Infarction", "Chest Pain", "has_symptom", {"note": "crushing substernal"}),
    ("Heart Failure", "Dyspnea", "has_symptom", {}),
    ("Pulmonary Embolism", "Dyspnea", "has_symptom", {"note": "sudden onset"}),
    ("Pulmonary Embolism", "Hemoptysis", "has_symptom", {}),
    ("Pulmonary Embolism", "Chest Pain", "has_symptom", {"note": "pleuritic"}),
    ("Hepatitis B", "Jaundice", "has_symptom", {}),
    ("Chronic Kidney Disease", "Hematuria", "has_symptom", {}),
    ("Systemic Lupus Erythematosus", "Butterfly Rash", "has_symptom", {}),
    ("Graves Disease", "Exophthalmos", "has_symptom", {}),
    ("Iron Deficiency Anemia", "Dyspnea", "has_symptom", {"note": "on exertion"}),
    # Disease → Investigation
    ("Type 2 Diabetes Mellitus", "HbA1c", "investigated_by", {"diagnostic_cutoff": ">=6.5%"}),
    ("Myocardial Infarction", "Troponin", "investigated_by", {"note": "rise/fall pattern"}),
    ("Myocardial Infarction", "ECG", "investigated_by", {"note": "ST elevation in STEMI"}),
    ("Heart Failure", "Echocardiography", "investigated_by", {"note": "EF assessment"}),
    ("Chronic Kidney Disease", "GFR", "investigated_by", {"staging": True}),
    ("Graves Disease", "RAIU Scan", "investigated_by", {"finding": "diffuse uptake"}),
    ("Pulmonary Embolism", "ECG", "investigated_by", {"finding": "S1Q3T3"}),
    ("Deep Vein Thrombosis", "INR", "investigated_by", {"note": "monitoring warfarin"}),
    ("Systemic Lupus Erythematosus", "ANA", "investigated_by", {"note": "entry criterion"}),
    # Disease → Disease (differentials, complications)
    ("Myocardial Infarction", "Pulmonary Embolism", "differential_of", {}),
    ("Type 2 Diabetes Mellitus", "Chronic Kidney Disease", "complication", {}),
    ("Type 2 Diabetes Mellitus", "Myocardial Infarction", "risk_factor_for", {}),
    ("Hypertension", "Myocardial Infarction", "risk_factor_for", {}),
    ("Hypertension", "Chronic Kidney Disease", "risk_factor_for", {}),
    ("Hypertension", "Heart Failure", "risk_factor_for", {}),
    ("Type 1 Diabetes Mellitus", "Diabetic Ketoacidosis", "complication", {}),
    ("Deep Vein Thrombosis", "Pulmonary Embolism", "complication", {}),
    ("Hepatitis B", "Chronic Kidney Disease", "complication", {"note": "membranous nephropathy"}),
    ("Graves Disease", "Heart Failure", "complication", {"note": "high-output"}),
    ("Systemic Lupus Erythematosus", "Chronic Kidney Disease", "complication", {"note": "lupus nephritis"}),
    # Drug interactions / contraindications
    ("Metformin", "Chronic Kidney Disease", "contraindicated_in", {"note": "lactic acidosis risk if GFR<30"}),
    ("Enalapril", "Hyperkalemia", "causes", {"mechanism": "decreased aldosterone"}),
    ("Warfarin", "Aspirin", "interacts_with", {"effect": "increased bleeding risk"}),
    ("Digoxin", "Hypokalemia", "interacts_with", {"effect": "increased toxicity"}),
    ("Propranolol", "Diabetes Mellitus", "interacts_with", {"effect": "masks hypoglycemia symptoms"}),
    # Drug → Mechanism
    ("Metformin", "AMPK Activation", "mechanism", {"note": "decreases hepatic glucose production"}),
    ("Warfarin", "Vitamin K Antagonism", "mechanism", {"note": "blocks VKORC1"}),
    ("Aspirin", "COX-1 Inhibition", "mechanism", {"note": "irreversible, antiplatelet effect"}),
    ("Digoxin", "Na+/K+-ATPase Inhibition", "mechanism", {}),
    ("Phenytoin", "Na+ Channel Blockade", "mechanism", {}),
    # Procedure → Disease
    ("PCI", "Myocardial Infarction", "indicated_for", {"note": "primary PCI within 90 min"}),
    ("Thyroidectomy", "Graves Disease", "indicated_for", {"note": "if radioiodine fails"}),
    ("Dialysis", "Chronic Kidney Disease", "indicated_for", {"note": "Stage 5, GFR<10"}),
    # Additional entity-type relationships for knowledge graph completeness
    ("Hyperkalemia", "Chronic Kidney Disease", "complication", {}),
    ("Hypokalemia", "Digoxin Toxicity", "risk_factor_for", {}),
    ("AMPK Activation", "Type 2 Diabetes Mellitus", "mechanism", {"note": "therapeutic target"}),
    ("Vitamin K Antagonism", "Deep Vein Thrombosis", "mechanism", {"note": "via warfarin"}),
    ("COX-1 Inhibition", "Myocardial Infarction", "mechanism", {"note": "antiplatelet prophylaxis"}),
    ("Na+/K+-ATPase Inhibition", "Heart Failure", "mechanism", {"note": "positive inotrope"}),
    ("Na+ Channel Blockade", "Epilepsy", "mechanism", {"note": "stabilizes neuronal membranes"}),
]

# Add extra entities referenced only in relationships
EXTRA_ENTITIES = [
    ("condition", "Hyperkalemia", [], {"system": "metabolic"}),
    ("condition", "Hypokalemia", [], {"system": "metabolic"}),
    ("condition", "Digoxin Toxicity", [], {}),
    ("pathway", "AMPK Activation", [], {"type": "signaling"}),
    ("pathway", "Vitamin K Antagonism", [], {"type": "pharmacological"}),
    ("pathway", "COX-1 Inhibition", [], {"type": "pharmacological"}),
    ("pathway", "Na+/K+-ATPase Inhibition", [], {"type": "pharmacological"}),
    ("pathway", "Na+ Channel Blockade", [], {"type": "pharmacological"}),
    ("condition", "Diabetes Mellitus", ["DM"], {}),
]


# ---------------------------------------------------------------------------
# Seeding functions
# ---------------------------------------------------------------------------

def compute_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def seed_medical_content(
    db: AsyncSession,
    skip_embeddings: bool = False,
) -> dict[str, int]:
    """Seed MedicalContent table with all subjects."""
    from app.engines.ai.models import MedicalContent

    openai_client = None
    if not skip_embeddings:
        from openai import AsyncOpenAI
        from app.config import get_settings
        settings = get_settings()
        if not settings.OPENAI_API_KEY:
            logger.warning("OPENAI_API_KEY not set — skipping embeddings")
            skip_embeddings = True
        else:
            openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    total_created = 0
    total_skipped = 0

    for subject, chunks in ALL_CONTENT_BY_SUBJECT.items():
        logger.info("Seeding %s — %d chunks", subject, len(chunks))
        total_chunks = len(chunks)

        for idx, chunk in enumerate(chunks):
            content_hash = compute_hash(chunk["content"])

            # Check for existing (deduplication)
            existing = await db.execute(
                select(MedicalContent.id).where(
                    MedicalContent.content_hash == content_hash,
                )
            )
            if existing.scalar_one_or_none():
                total_skipped += 1
                continue

            embedding = None
            if not skip_embeddings and openai_client:
                try:
                    resp = await openai_client.embeddings.create(
                        model="text-embedding-3-large",
                        input=chunk["content"],
                        dimensions=1536,
                    )
                    embedding = resp.data[0].embedding
                except Exception as e:
                    logger.warning("Embedding failed for %s: %s", chunk["title"], e)

            record = MedicalContent(
                id=uuid4(),
                college_id=None,  # platform-wide
                source_type="textbook",
                title=chunk["title"],
                content=chunk["content"],
                content_hash=content_hash,
                embedding=embedding,
                chunk_index=idx,
                total_chunks=total_chunks,
                parent_document_id=None,
                metadata_=chunk["metadata"],
                source_reference=chunk["source_reference"],
                medical_entity_type=subject.lower(),
                is_active=True,
            )
            db.add(record)
            total_created += 1

        await db.flush()
        logger.info("  %s: %d chunks seeded", subject, len(chunks))

    return {"created": total_created, "skipped": total_skipped}


async def seed_medical_entities(db: AsyncSession) -> dict[str, int]:
    """Seed MedicalEntity table."""
    from app.engines.ai.models import MedicalEntity

    all_entities = ENTITIES + EXTRA_ENTITIES
    created = 0
    skipped = 0

    for entity_type, name, aliases, properties in all_entities:
        existing = await db.execute(
            select(MedicalEntity.id).where(
                MedicalEntity.entity_type == entity_type,
                MedicalEntity.name == name,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        entity = MedicalEntity(
            id=uuid4(),
            entity_type=entity_type,
            name=name,
            aliases=aliases if aliases else None,
            properties=properties if properties else None,
            embedding=None,
            is_active=True,
        )
        db.add(entity)
        created += 1

    await db.flush()
    return {"created": created, "skipped": skipped}


async def seed_entity_relationships(db: AsyncSession) -> dict[str, int]:
    """Seed MedicalEntityRelationship table."""
    from app.engines.ai.models import MedicalEntity, MedicalEntityRelationship

    # Build name → id lookup
    result = await db.execute(select(MedicalEntity.id, MedicalEntity.name))
    name_to_id = {row.name: row.id for row in result.all()}

    created = 0
    skipped = 0
    missing = 0

    for source_name, target_name, rel_type, props in RELATIONSHIPS:
        source_id = name_to_id.get(source_name)
        target_id = name_to_id.get(target_name)

        if not source_id or not target_id:
            names_missing = []
            if not source_id:
                names_missing.append(source_name)
            if not target_id:
                names_missing.append(target_name)
            logger.debug(
                "Skipping relationship %s→%s: missing entities %s",
                source_name, target_name, names_missing,
            )
            missing += 1
            continue

        # Check for existing
        existing = await db.execute(
            select(MedicalEntityRelationship.id).where(
                MedicalEntityRelationship.source_entity_id == source_id,
                MedicalEntityRelationship.target_entity_id == target_id,
                MedicalEntityRelationship.relationship_type == rel_type,
            )
        )
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        rel = MedicalEntityRelationship(
            id=uuid4(),
            source_entity_id=source_id,
            target_entity_id=target_id,
            relationship_type=rel_type,
            properties=props if props else None,
            confidence=1.0,
            source_reference="Seed data — standard medical knowledge",
            is_active=True,
        )
        db.add(rel)
        created += 1

    await db.flush()
    return {"created": created, "skipped": skipped, "missing_entities": missing}


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

async def main(skip_embeddings: bool = False, dry_run: bool = False) -> None:
    """Run the full seed pipeline."""
    from app.core.database import async_session_factory

    if dry_run:
        total_chunks = sum(len(c) for c in ALL_CONTENT_BY_SUBJECT.values())
        total_entities = len(ENTITIES) + len(EXTRA_ENTITIES)
        total_rels = len(RELATIONSHIPS)
        logger.info("DRY RUN — would seed:")
        logger.info("  MedicalContent: %d chunks across %d subjects", total_chunks, len(ALL_CONTENT_BY_SUBJECT))
        logger.info("  MedicalEntity: %d entities", total_entities)
        logger.info("  MedicalEntityRelationship: %d relationships", total_rels)
        return

    async with async_session_factory() as db:
        try:
            # Set RLS context to bypass (neondb_owner role) — seed data is platform-wide
            # For medical_content with college_id=NULL, no RLS applies anyway.

            logger.info("=== Step 1: Seeding Medical Content ===")
            content_result = await seed_medical_content(db, skip_embeddings=skip_embeddings)
            logger.info(
                "Content: created=%d, skipped=%d",
                content_result["created"], content_result["skipped"],
            )

            logger.info("=== Step 2: Seeding Medical Entities ===")
            entity_result = await seed_medical_entities(db)
            logger.info(
                "Entities: created=%d, skipped=%d",
                entity_result["created"], entity_result["skipped"],
            )

            logger.info("=== Step 3: Seeding Entity Relationships ===")
            rel_result = await seed_entity_relationships(db)
            logger.info(
                "Relationships: created=%d, skipped=%d, missing=%d",
                rel_result["created"], rel_result["skipped"], rel_result["missing_entities"],
            )

            await db.commit()
            logger.info("=== Seed complete! ===")

        except Exception:
            await db.rollback()
            logger.error("Seed failed — rolled back", exc_info=True)
            raise


if __name__ == "__main__":
    skip_emb = "--skip-embeddings" in sys.argv
    dry = "--dry-run" in sys.argv

    if skip_emb:
        logger.info("Running with --skip-embeddings (no OpenAI API calls)")
    if dry:
        logger.info("Running in --dry-run mode")

    asyncio.run(main(skip_embeddings=skip_emb, dry_run=dry))

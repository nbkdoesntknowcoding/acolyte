"""NBME Item-Writing Standards — 19 flaw patterns.

Reference: NBME Item-Writing Guide, 6th Edition.
Used by MedicalSafetyPipeline (Section L3) to detect item-writing flaws
in AI-generated MCQs, SAQs, EMQs, and other question types.

Each flaw has:
- code: Short identifier (e.g. "ABSOLUTE_TERMS")
- name: Human-readable flaw name
- description: What the flaw is and why it's a problem
- examples: Concrete examples of the flaw in medical contexts
"""

import enum
from dataclasses import dataclass


class ItemWritingFlaw(str, enum.Enum):
    """The 19 NBME item-writing flaw codes."""

    ABSOLUTE_TERMS = "absolute_terms"
    GRAMMATICAL_CUES = "grammatical_cues"
    LONGEST_ANSWER_BIAS = "longest_answer_bias"
    ALL_NONE_OF_ABOVE = "all_none_of_above"
    IMPLAUSIBLE_DISTRACTORS = "implausible_distractors"
    NEGATIVE_STEM_NO_EMPHASIS = "negative_stem_no_emphasis"
    WINDOW_DRESSING = "window_dressing"
    CONVERGENCE_CUES = "convergence_cues"
    HETEROGENEOUS_OPTIONS = "heterogeneous_options"
    K_TYPE_ITEMS = "k_type_items"
    VAGUE_TERMS = "vague_terms"
    TRICKY_MISLEADING = "tricky_misleading"
    UNFOCUSED_STEM = "unfocused_stem"
    NON_INDEPENDENT_OPTIONS = "non_independent_options"
    WORD_REPEATS = "word_repeats"
    TESTWISE_CUES = "testwise_cues"
    LOGICAL_CUES = "logical_cues"
    CONSISTENT_POSITION = "consistent_position"
    MISSING_SINGLE_BEST = "missing_single_best"


@dataclass(frozen=True)
class FlawPattern:
    """Describes a single NBME item-writing flaw."""

    code: ItemWritingFlaw
    name: str
    description: str
    examples: str


# ---------------------------------------------------------------------------
# The 19 NBME flaw patterns
# ---------------------------------------------------------------------------

NBME_FLAW_PATTERNS: tuple[FlawPattern, ...] = (
    FlawPattern(
        code=ItemWritingFlaw.ABSOLUTE_TERMS,
        name="Absolute Terms",
        description=(
            "The stem or options use absolute qualifiers like 'always', "
            "'never', 'all', or 'none'. Test-wise students know to avoid "
            "these options because medical science rarely deals in absolutes."
        ),
        examples=(
            "'This drug ALWAYS causes hepatotoxicity' — few drugs always "
            "cause a specific side effect. "
            "'ALL patients with lupus have malar rash' — not all do."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.GRAMMATICAL_CUES,
        name="Grammatical Cues",
        description=(
            "The stem's grammatical structure (article agreement, verb "
            "conjugation, singular/plural) reveals the correct answer. "
            "E.g., 'An ___' immediately eliminates options starting with "
            "consonants."
        ),
        examples=(
            "Stem ends with 'a' but correct answer starts with a vowel. "
            "Stem uses 'are' but only one option is plural."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.LONGEST_ANSWER_BIAS,
        name="Longest Answer Bias",
        description=(
            "The correct answer is significantly longer or more detailed "
            "than the distractors. Test-wise students gravitate toward the "
            "longest, most qualified option."
        ),
        examples=(
            "Correct: 'Administer IV fluids at 20 mL/kg, reassess after "
            "each bolus, and consider vasopressors if unresponsive' (24 words). "
            "Distractors: 'Give antibiotics' (2 words), 'Observe' (1 word)."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.ALL_NONE_OF_ABOVE,
        name="'All of the Above' / 'None of the Above'",
        description=(
            "Options include 'All of the above' or 'None of the above'. "
            "These allow students to use partial knowledge (recognizing 2 "
            "correct options implies 'All of the above') and violate single "
            "best answer format."
        ),
        examples=(
            "'E. All of the above' — if a student knows A and C are correct, "
            "they can deduce E without knowing B or D."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.IMPLAUSIBLE_DISTRACTORS,
        name="Implausible Distractors",
        description=(
            "One or more distractors are obviously wrong to anyone with "
            "basic medical knowledge. This effectively reduces the number "
            "of options and inflates the guessing probability."
        ),
        examples=(
            "Question about chest pain treatment: 'A. Aspirin, B. Nitroglycerin, "
            "C. Vitamin C supplements, D. Herbal tea'. Options C and D are "
            "implausible."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.NEGATIVE_STEM_NO_EMPHASIS,
        name="Negative Stem Without Emphasis",
        description=(
            "The stem uses negative phrasing (NOT, EXCEPT, LEAST) without "
            "visual emphasis (capitalization, bold, underline). Students "
            "may miss the negation and select the opposite answer."
        ),
        examples=(
            "'Which of the following is not a feature of nephrotic syndrome?' "
            "— 'not' should be 'NOT' or 'EXCEPT'."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.WINDOW_DRESSING,
        name="Window Dressing",
        description=(
            "The stem includes excessive, irrelevant clinical details that "
            "do not contribute to answering the question. This wastes "
            "student time and tests reading stamina rather than knowledge."
        ),
        examples=(
            "A detailed social history, family tree, and travel history for "
            "a question that only requires knowing the side effects of "
            "metformin."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.CONVERGENCE_CUES,
        name="Convergence Cues",
        description=(
            "Two or more options overlap significantly or share elements, "
            "making the correct answer identifiable by finding the option "
            "that overlaps with the most other choices."
        ),
        examples=(
            "'A. Hypertension and diabetes, B. Diabetes and obesity, "
            "C. Diabetes and hyperlipidemia' — diabetes appears in A, B, "
            "and C, cueing that it's relevant."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.HETEROGENEOUS_OPTIONS,
        name="Heterogeneous Options",
        description=(
            "Options mix different categories (e.g., diagnoses with "
            "treatments, drugs with procedures). All options should be "
            "the same type to test discrimination within a category."
        ),
        examples=(
            "'A. Pneumonia, B. Amoxicillin, C. Chest X-ray, "
            "D. Bronchiectasis' — mixes diagnosis, drug, investigation, "
            "and diagnosis."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.K_TYPE_ITEMS,
        name="K-Type Items",
        description=(
            "The question asks 'Which combination is correct?' with "
            "options like '1 and 3', '2 and 4', 'All of the above'. "
            "This format is unreliable and penalizes partial knowledge."
        ),
        examples=(
            "'A. 1, 2, and 3 only. B. 1 and 3 only. C. 2 and 4 only. "
            "D. 4 only. E. All of the above.'"
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.VAGUE_TERMS,
        name="Vague Terms",
        description=(
            "The stem or options use imprecise qualifiers like 'usually', "
            "'frequently', 'sometimes', 'rarely', 'often' without "
            "quantifying what these terms mean."
        ),
        examples=(
            "'This drug frequently causes nausea' — 'frequently' is "
            "subjective. Better: 'occurs in >30% of patients'."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.TRICKY_MISLEADING,
        name="Tricky or Misleading Stems",
        description=(
            "The stem is intentionally designed to mislead through "
            "ambiguity, double negatives, or misdirection rather than "
            "testing genuine medical knowledge."
        ),
        examples=(
            "'Which of the following is NOT an uncommon side effect...?' "
            "— double negation confuses meaning."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.UNFOCUSED_STEM,
        name="Unfocused Stem",
        description=(
            "The stem does not contain a clear, specific question. "
            "Students cannot determine what is being asked without "
            "reading all options first."
        ),
        examples=(
            "'A 45-year-old male presents with chest pain...' followed "
            "directly by options without asking 'What is the most likely "
            "diagnosis?' or 'What is the next best step?'"
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.NON_INDEPENDENT_OPTIONS,
        name="Non-Independent Options",
        description=(
            "One option logically implies or excludes another. If A is "
            "true, B must also be true (or cannot be true), reducing "
            "the effective number of independent choices."
        ),
        examples=(
            "'A. Type 2 diabetes, B. Insulin resistance syndrome, "
            "C. Metabolic syndrome' — B is a component of C, and A is "
            "part of C."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.WORD_REPEATS,
        name="Word Repeats Between Stem and Key",
        description=(
            "The correct answer shares distinctive words or phrases "
            "with the stem that distractors do not. Students can match "
            "vocabulary to identify the answer without clinical reasoning."
        ),
        examples=(
            "Stem: '...renal tubular acidosis...' "
            "Correct: 'Distal renal tubular acidosis type 1'. "
            "Distractors don't mention 'renal' or 'tubular'."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.TESTWISE_CUES,
        name="Testwise Cues",
        description=(
            "Formatting differences between the correct answer and "
            "distractors reveal the key — e.g., the correct answer is "
            "in a different font, has different punctuation, or uses "
            "a different level of specificity."
        ),
        examples=(
            "Correct answer uses 'mg/dL' units while distractors don't "
            "specify units. Correct answer is the only one in italics."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.LOGICAL_CUES,
        name="Logical Cues",
        description=(
            "Options are subsets or supersets of each other, allowing "
            "elimination by logic rather than knowledge. If A includes "
            "B, then B can never be the single best answer."
        ),
        examples=(
            "'A. Administer oxygen. B. Administer oxygen and start IV "
            "fluids.' — A is a subset of B; if B is an option, A alone "
            "cannot be the best answer."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.CONSISTENT_POSITION,
        name="Correct Answer in Consistent Position",
        description=(
            "The correct answer is systematically placed in the same "
            "position (e.g., always option B or C). Answer positions "
            "should be randomized across questions."
        ),
        examples=(
            "In a 50-question exam, the correct answer is option C for "
            "40% of questions — well above the expected 20-25%."
        ),
    ),
    FlawPattern(
        code=ItemWritingFlaw.MISSING_SINGLE_BEST,
        name="Missing 'Single Best Answer' Framing",
        description=(
            "The stem does not clearly indicate that exactly one answer "
            "should be selected, or multiple options could be considered "
            "correct without clear differentiation."
        ),
        examples=(
            "'Which of the following can cause hepatitis?' without 'MOST "
            "likely' or 'single best' — multiple answers are technically "
            "correct."
        ),
    ),
)


# ---------------------------------------------------------------------------
# Flaw lookup helpers
# ---------------------------------------------------------------------------

FLAW_BY_CODE: dict[ItemWritingFlaw, FlawPattern] = {
    fp.code: fp for fp in NBME_FLAW_PATTERNS
}

FLAW_CODE_LIST: list[str] = [fp.code.value for fp in NBME_FLAW_PATTERNS]


# ---------------------------------------------------------------------------
# Detection prompt
# ---------------------------------------------------------------------------

def build_item_writing_flaw_prompt() -> str:
    """Build the detection prompt listing all 19 NBME flaw patterns.

    The prompt instructs the model to check the question for each flaw
    and return structured output with detected flaws and their evidence.
    """
    flaw_descriptions = []
    for i, fp in enumerate(NBME_FLAW_PATTERNS, 1):
        flaw_descriptions.append(
            f"{i}. {fp.name} ({fp.code.value}): {fp.description}"
        )

    flaw_list = "\n".join(flaw_descriptions)

    return f"""\
You are a medical education assessment expert trained in the NBME \
Item-Writing Guide (6th Edition). Analyze the given question for \
item-writing flaws.

Check for ALL of the following 19 flaw patterns:

{flaw_list}

For each flaw detected:
- Identify the specific flaw code
- Quote the exact text that exhibits the flaw
- Explain why it is problematic
- Suggest a specific fix

If the question has no flaws, report an empty list.

Be thorough but avoid false positives — only flag genuine flaws that \
would compromise question validity or fairness. Not every use of a \
qualifier like "usually" is a flaw if it reflects genuine clinical \
uncertainty."""

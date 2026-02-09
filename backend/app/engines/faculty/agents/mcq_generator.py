"""MCQ Generator Agent — LangGraph StateGraph.

Generates NBME-standard MCQs with multi-layer quality gates.
Called ONLY through the Central AI Engine's public interface.
"""

# This agent is called via: from app.engines.ai import generate_mcq
# Implementation will use LangGraph StateGraph with:
# 1. retrieve_context (RAG)
# 2. generate_question (Claude Sonnet)
# 3. check_item_writing (NBME standards)
# 4. check_medical_accuracy
# 5. check_blooms_alignment
# 6. safety_check
# 7. format_output

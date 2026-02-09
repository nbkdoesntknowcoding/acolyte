"""Central AI Engine — Public Interface.

ALL AI calls from other engines go through this interface.
ONLY this engine imports LangGraph/LiteLLM.

Example usage from other engines:
    from app.engines.ai import generate_mcq, socratic_chat
"""

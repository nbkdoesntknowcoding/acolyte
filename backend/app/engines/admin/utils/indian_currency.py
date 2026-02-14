"""Indian currency formatting utilities.

All amounts stored in paisa (1 rupee = 100 paisa).
Indian number system: lakhs (1,00,000) and crores (1,00,00,000).
"""


def format_inr(paisa: int) -> str:
    """Format paisa amount as Indian Rupees string.

    Examples:
        format_inr(1423560000) → "₹1,42,35,600.00"
        format_inr(50000) → "₹500.00"
        format_inr(0) → "₹0.00"
    """
    if paisa < 0:
        return f"-{format_inr(abs(paisa))}"

    rupees = paisa // 100
    paise = paisa % 100

    if rupees == 0:
        return f"₹0.{paise:02d}"

    # Indian grouping: last 3, then groups of 2
    s = str(rupees)
    if len(s) <= 3:
        formatted = s
    else:
        # Last 3 digits
        last_three = s[-3:]
        remaining = s[:-3]
        # Group remaining by 2
        groups = []
        while remaining:
            groups.append(remaining[-2:])
            remaining = remaining[:-2]
        groups.reverse()
        formatted = ",".join(groups) + "," + last_three

    return f"₹{formatted}.{paise:02d}"


def paisa_to_rupees(paisa: int) -> float:
    """Convert paisa to rupees as a float.

    Example: paisa_to_rupees(150000) → 1500.0
    """
    return paisa / 100


def rupees_to_paisa(rupees: float) -> int:
    """Convert rupees to paisa.

    Example: rupees_to_paisa(1500.50) → 150050
    """
    return round(rupees * 100)


def format_inr_short(paisa: int) -> str:
    """Format paisa as short Indian currency string.

    Examples:
        format_inr_short(1000000000000) → "₹1,000 Cr"
        format_inr_short(142356000000) → "₹1,423.6 Cr"
        format_inr_short(5000000000) → "₹50 Cr"
        format_inr_short(150000000) → "₹15 L"
        format_inr_short(5000000) → "₹50,000"
        format_inr_short(50000) → "₹500"
    """
    rupees = paisa / 100

    if rupees >= 10_000_000:  # 1 crore+
        crores = rupees / 10_000_000
        if crores == int(crores):
            return f"₹{int(crores):,} Cr"
        return f"₹{crores:,.1f} Cr"
    elif rupees >= 100_000:  # 1 lakh+
        lakhs = rupees / 100_000
        if lakhs == int(lakhs):
            return f"₹{int(lakhs):,} L"
        return f"₹{lakhs:,.1f} L"
    else:
        return f"₹{int(rupees):,}"

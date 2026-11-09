"""Multi-agent branch: is "assistant + reviewer" better than one assistant?

Both setups answered the same replay questions, so compare them question by
question (a paired comparison). With only a handful of questions, the honest
answer for accuracy is often "can't tell yet", while latency and cost
differences are large and consistent.

Run:
    python compare.py
"""
import json
import math

# Two-sided 95% critical values of Student's t, by degrees of freedom.
T95 = {1: 12.71, 2: 4.30, 3: 3.18, 4: 2.78, 5: 2.57, 6: 2.45, 7: 2.36, 8: 2.31,
       9: 2.26, 10: 2.23, 15: 2.13, 20: 2.09, 30: 2.04}


def t95(df):
    return T95.get(df) or next((T95[k] for k in sorted(T95) if k >= df), 1.96)


def paired(diffs):
    """Mean difference, its 95% interval, and how many questions it would take
    for the interval to exclude zero if the difference and spread stayed the same."""
    n = len(diffs)
    mean = sum(diffs) / n
    sd = math.sqrt(sum((d - mean) ** 2 for d in diffs) / (n - 1))
    half = t95(n - 1) * sd / math.sqrt(n)
    needed = math.ceil((1.96 * sd / abs(mean)) ** 2) if mean else math.inf
    return mean, (mean - half, mean + half), needed


METRICS = [
    ("citation accuracy", lambda r: r["supported"] / r["claims"], "{:+.0%}", "higher"),
    ("latency (s)", lambda r: r["latency_s"], "{:+.1f}", "lower"),
    ("cost (USD)", lambda r: r["cost_usd"], "{:+.4f}", "lower"),
]

if __name__ == "__main__":
    data = json.load(open("recorded_comparison.json"))
    qs = data["questions"]
    print(f"{len(qs)} questions, paired: reviewed − single for each question\n")
    for name, get, fmt, better in METRICS:
        diffs = [get(q["reviewed"]) - get(q["single"]) for q in qs]
        mean, (lo, hi), needed = paired(diffs)
        print(f"{name:<18} per question: " + "  ".join(fmt.format(d) for d in diffs))
        print(f"{'':<18} mean {fmt.format(mean)}   95% interval {fmt.format(lo)} to {fmt.format(hi)}")
        if lo <= 0 <= hi:
            print(f"{'':<18} → can't tell yet. At this size and spread you'd need ~{needed} questions.\n")
        else:
            direction = "higher" if mean > 0 else "lower"
            print(f"{'':<18} → reliably {direction} with the reviewer.\n")

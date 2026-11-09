"""A tiny local paper index, so the assistant runs offline.

The papers and arXiv IDs are real. The summaries are short paraphrases written
for this course, not the papers' abstracts.
"""

import re

PAPERS = [
    {
        "id": "arXiv:2210.03629",
        "short": "ReAct",
        "title": "ReAct: Synergizing Reasoning and Acting in Language Models",
        "year": 2022,
        "summary": "Interleaves reasoning traces with actions such as search, so each "
                   "reasoning step chooses the next action and each result informs the next step.",
    },
    {
        "id": "arXiv:2302.04761",
        "short": "Toolformer",
        "title": "Toolformer: Language Models Can Teach Themselves to Use Tools",
        "year": 2023,
        "summary": "Trains a model to decide which API to call, when to call it and with "
                   "what arguments, from self-labelled examples of helpful calls.",
    },
    {
        "id": "arXiv:2305.15334",
        "short": "Gorilla",
        "title": "Gorilla: Large Language Model Connected with Massive APIs",
        "year": 2023,
        "summary": "Fine-tunes a model on API documentation so it writes accurate API calls "
                   "with fewer invented arguments, and measures call accuracy on real APIs.",
    },
    {
        "id": "arXiv:2307.16789",
        "short": "ToolLLM",
        "title": "ToolLLM: Facilitating Large Language Models to Master 16000+ Real-world APIs",
        "year": 2023,
        "summary": "Builds instructions for thousands of real APIs and fine-tunes a model to "
                   "plan and execute multi-step API calls, with an automatic evaluator.",
    },
    {
        "id": "arXiv:2303.11366",
        "short": "Reflexion",
        "title": "Reflexion: Language Agents with Verbal Reinforcement Learning",
        "year": 2023,
        "summary": "Has an agent write feedback on its own failed attempts and keep it in "
                   "memory, so later attempts improve without changing model weights.",
    },
    {
        "id": "arXiv:2303.17651",
        "short": "Self-Refine",
        "title": "Self-Refine: Iterative Refinement with Self-Feedback",
        "year": 2023,
        "summary": "Uses one model to draft an answer, critique it and revise it in a loop, "
                   "improving outputs without extra training.",
    },
    {
        "id": "arXiv:2307.03172",
        "short": "Lost in the Middle",
        "title": "Lost in the Middle: How Language Models Use Long Contexts",
        "year": 2023,
        "summary": "Shows that models use information at the start and end of a long context "
                   "better than information placed in the middle.",
    },
    {
        "id": "arXiv:2306.05685",
        "short": "Zheng et al. (MT-Bench)",
        "title": "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena",
        "year": 2023,
        "summary": "Studies strong language models as judges of other models' answers, "
                   "measuring agreement with human judges and biases such as position and verbosity.",
    },
    {
        "id": "arXiv:2005.11401",
        "short": "Retrieval-augmented generation",
        "title": "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
        "year": 2020,
        "summary": "Combines a retriever over a document index with a generator, so answers "
                   "are conditioned on retrieved passages and hallucinate less.",
    },
]

STOPWORDS = set(
    "a an and are as at be by can do does for from how i in is it its of on or "
    "should that the their they this to what when which while who why with when "
    "will would you your my me we our".split()
)


def terms(text):
    """Lower-case content words, crudely stemmed so 'agents' matches 'agent'."""
    words = re.findall(r"[a-z0-9]+", text.lower())
    out = []
    for w in words:
        if w in STOPWORDS or len(w) < 3:
            continue
        for suffix in ("ing", "ed", "es", "s"):
            if w.endswith(suffix) and len(w) - len(suffix) >= 4:
                w = w[: -len(suffix)]
                break
        if w.endswith("e") and len(w) > 4:
            w = w[:-1]
        out.append(w)
    return out


def search_papers(query, limit=3):
    """Read-only keyword search. Returns up to `limit` papers, best match first."""
    q = set(terms(query))
    scored = []
    for paper in PAPERS:
        overlap = len(q & set(terms(paper["title"] + " " + paper["summary"])))
        if overlap:
            scored.append((-overlap, paper["id"], paper))
    scored.sort()
    return [dict(p) for _, _, p in scored[:limit]]


if __name__ == "__main__":
    import sys

    for p in search_papers(" ".join(sys.argv[1:]) or "language model agents tool use"):
        print(p["id"], p["title"])

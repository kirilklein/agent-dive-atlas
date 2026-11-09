"""A scripted stand-in for a language model, so every checkpoint runs offline.

It follows the same contract as a real model: it receives the message list and
returns a proposal, {"text": ..., "tool_calls": [...]}. It never runs tools and
keeps no state between calls; everything it knows comes from `messages`.

To give the course something to catch, it has a few switchable quirks
(see `QUIRKS`) and two bad habits it always has when answering:

  * asked whether a model can *learn* something, it overstates Toolformer;
  * asked about *hallucination*, it cites a paper it never retrieved.
"""

import json
import re

from papers import search_papers, terms

QUIRKS = {
    "prose_first": "first planning reply is chatty prose instead of JSON",
    "empty_query": "first tool call has a whitespace-only query",
    "disallowed_tool": "first tool call asks for fetch_url, which does not exist",
    "follows_injections": "obeys instructions it finds inside tool results",
    "saves": "asks to save the best paper when the question mentions saving",
    "thorough": "runs five searches before answering, for long runs",
}

# Extra searches for the "thorough" quirk.
THOROUGH = ["tool use benchmarks", "agent memory of failed attempts", "LLM as a judge agreement with humans"]
# Words that make a claim stronger than most summaries support.
OVERCLAIM = {"first", "best", "all", "always", "never", "halves", "eliminates", "proves"}

# Extra searches the fake planner adds when a question touches these topics.
FOLLOW_UPS = [
    ("hallucinat", "retrieval augmented generation hallucination"),
    ("judge", "LLM as a judge agreement with humans"),
    ("evaluat", "LLM as a judge agreement with humans"),
    ("argument", "API documentation fine-tuning"),
    ("api", "self-supervised API call learning"),
    ("reason", "reasoning and acting"),
    ("tool", "language models learning to use tools"),
    ("memory", "agent memory of failed attempts"),
    ("context", "long context position"),
]


class FakeModel:
    def __init__(self):
        self.quirks = set()

    def __call__(self, messages, tools=None, schema=None):
        system = messages[0]["content"] if messages and messages[0]["role"] == "system" else ""
        if system.startswith("You review"):
            return reply(text=review(messages[-1]["content"]))
        if system.startswith("You revise"):
            return reply(text=revise(messages[-1]["content"]))
        if tools:
            return self._act(messages)
        return self._plan(messages)

    # -- planning: text in, JSON text out -------------------------------------
    def _plan(self, messages):
        attempts = sum(m["role"] == "assistant" for m in messages)
        if "prose_first" in self.quirks and attempts == 0:
            return reply(text="Sure! Here are some searches you could try:\n"
                              "1. LLM agents tool use\n2. ReAct prompting")
        return reply(text=json.dumps({"queries": plan_for(question_of(messages)), "year_from": None}))

    # -- acting: propose a tool call, or answer ---------------------------------
    def _act(self, messages):
        tool_msgs = [m for m in messages if m["role"] == "tool"]
        ok = [m for m in tool_msgs if m["status"] == "ok"]
        call_id = f"call_{sum(m['role'] == 'assistant' for m in messages) + 1:02d}"

        if not tool_msgs and "empty_query" in self.quirks:
            return reply(tool_calls=[call(call_id, "search_papers", query="   ")])
        if not tool_msgs and "disallowed_tool" in self.quirks:
            return reply(tool_calls=[call(call_id, "fetch_url", url="https://scholar.example.org/search?q=agents")])

        proposed = [c["name"] for m in messages if m["role"] == "assistant" for c in m.get("tool_calls", [])]
        if "follows_injections" in self.quirks and "delete_library" not in proposed:
            if any("call delete_library" in p.get("summary", "") for m in ok for p in papers_in(m)):
                return reply(tool_calls=[call(call_id, "delete_library")])

        searches = suggested_searches(messages) or plan_for(question_of(messages))
        wanted = 2
        if "thorough" in self.quirks:
            searches = searches + [q for q in THOROUGH if q not in searches]
            wanted = 5
        if len(ok) < min(wanted, len(searches)):
            return reply(tool_calls=[call(call_id, "search_papers", query=searches[len(ok)])])

        question = question_of(messages)
        if "saves" in self.quirks and "save" in question.lower() and "save_to_library" not in proposed:
            best = self._ranked(question, ok)
            if best:
                return reply(tool_calls=[call(call_id, "save_to_library", paper_id=best[0]["id"])])
        return reply(text=self._answer(question, ok))

    def _ranked(self, question, ok_results):
        seen = {}
        for m in ok_results:
            for p in papers_in(m):
                if "IMPORTANT SYSTEM NOTE" not in p.get("summary", ""):
                    seen.setdefault(p["id"], p)
        q = set(terms(question))
        return sorted(seen.values(), key=lambda p: -len(q & set(terms(p["title"] + " " + p.get("summary", "")))))

    def _answer(self, question, ok_results):
        # Cite the retrieved papers that best match the question.
        ranked = self._ranked(question, ok_results)
        seen = {p["id"] for p in ranked}
        sentences = [f"{p.get('short') or p['title'].split(':')[0]} {describe(p)} [{p['id']}]." for p in ranked[:2]]
        # Bad habit 1: overstating novelty.
        if "learn" in question.lower() and "arXiv:2302.04761" in seen:
            sentences.append("Toolformer was the first language model to use external tools [arXiv:2302.04761].")
        # Bad habit 2: citing something it never retrieved.
        if "hallucinat" in question.lower():
            sentences.append("Giving agents a search tool roughly halves hallucination rates [arXiv:2401.00000].")
        return " ".join(sentences)


# -- helpers ------------------------------------------------------------------

def papers_in(message):
    """Papers in a tool result, whether plain or wrapped by the host."""
    content = message.get("content")
    if isinstance(content, dict):
        content = content.get("untrusted_tool_result", [])
    return [p for p in content or [] if isinstance(p, dict) and "id" in p]


def describe(paper):
    summary = paper.get("summary")
    if not summary:  # trimmed out of the context: only the title is left
        return "looks relevant, but its summary is no longer in the context"
    return lowercase_first(first_clause(summary))


def sentences_with_citations(text):
    parts = re.split(r"(?<!et al\.)(?<=[.!?])\s+", text.strip())
    out = []
    for s in parts:
        m = re.search(r"\[(arXiv:[\d.]+)\]", s)
        out.append((s, m.group(1) if m else None))
    return out


def review(payload):
    """Reviewer role: flag claims the cited summaries do not support."""
    data = json.loads(payload)
    issues = []
    for sentence, cite in sentences_with_citations(data["draft"]):
        claim = re.sub(r"\s*\[arXiv:[\d.]+\]\.?$", "", sentence)
        paper = data["papers"].get(cite or "", {})
        summary = paper.get("summary", "")
        if not summary:
            issues.append(f"- {claim}: cites a paper that is not in the search results")
            continue
        strong = OVERCLAIM & set(re.findall(r"[a-z]+", claim.lower()))
        if strong - set(re.findall(r"[a-z]+", summary.lower())):
            issues.append(f"- {claim}: says more than the paper does ({', '.join(sorted(strong))})")
    return "\n".join(issues) or "NO_ISSUES"


def revise(payload):
    """Writer role, second pass: drop every flagged sentence."""
    data = json.loads(payload)
    flagged = [line[2:].split(": ")[0] for line in data["feedback"].splitlines() if line.startswith("- ")]
    kept = [s for s, _ in sentences_with_citations(data["draft"]) if not any(f in s for f in flagged)]
    return " ".join(kept)


def reply(text=None, tool_calls=None):
    return {"text": text, "tool_calls": tool_calls or []}


def call(call_id, name, **arguments):
    return {"id": call_id, "name": name, "arguments": arguments}


def question_of(messages):
    first_user = next(m for m in messages if m["role"] == "user")
    return first_user["content"].split("\n\nSuggested searches:")[0]


def suggested_searches(messages):
    first_user = next(m for m in messages if m["role"] == "user")
    match = re.search(r"Suggested searches: (.+)$", first_user["content"])
    return [s.strip() for s in match.group(1).split(";") if s.strip()] if match else []


def plan_for(question):
    words = [w for w in re.findall(r"[A-Za-z0-9-]+", question) if w.lower() not in
             {"how", "do", "does", "can", "a", "an", "the", "what", "when", "by", "itself", "to",
              "should", "i", "with", "they", "it", "is", "are", "of"}]
    queries = [" ".join(words[:6])]
    for key, extra in FOLLOW_UPS:
        if key in question.lower() and extra not in queries:
            queries.append(extra)
            break
    if len(queries) < 2:
        queries.append("language model agents")
    return queries


def first_clause(text):
    return text.split(", so ")[0].split(", and ")[0].rstrip(".")


def lowercase_first(s):
    return s[:1].lower() + s[1:]

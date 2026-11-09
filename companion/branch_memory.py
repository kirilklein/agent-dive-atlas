"""Paper-search assistant · branch B: Context & memory

Two different things that both end up in the message list:
  * state within a run: the messages plus a little structured state (RunState);
  * memory across runs: a small file you write on purpose (memory.json) and load
    into the system message when a run starts.
And one cost: every call resends the whole history, so trim old results.

Run:
    python branch_memory.py                          # a long run, with and without trimming
    python branch_memory.py --remember year_from=2023
    python branch_memory.py --forget
"""
import json
import os
import sys
from dataclasses import dataclass, field

from checkpoint_3 import AGENT, SEARCH_PAPERS, brief, handle_tool_call
from llm import call_model, set_quirks, set_trace

MEMORY_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "memory.json")


# -- memory across runs: explicit, small, editable ------------------------------

def load_memory():
    try:
        with open(MEMORY_PATH) as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def remember(key, value):
    memory = load_memory()
    memory[key] = value
    with open(MEMORY_PATH, "w") as f:
        json.dump(memory, f, indent=2)
    return memory


def system_message(memory):
    if not memory:
        return AGENT
    return {"role": "system", "content": AGENT["content"]
            + "\n\nSaved user preferences: " + json.dumps(memory)}


# -- state within a run -------------------------------------------------------------

@dataclass
class RunState:
    messages: list
    step: int = 0
    seen_ids: set = field(default_factory=set)
    sent_tokens: list = field(default_factory=list)


def approx_tokens(messages):
    return len(json.dumps(messages)) // 4  # rough: about four characters per token


def trim(messages, keep_last=2):
    """Shrink all but the last few tool results to id + title."""
    tool_idx = [i for i, m in enumerate(messages) if m["role"] == "tool"]
    for i in tool_idx[:-keep_last]:
        papers = messages[i].get("content") or []
        messages[i] = {**messages[i], "content": [
            {"id": p["id"], "title": p["title"]} for p in papers]}
    return messages


def run(question, memory, keep_last=None, max_steps=8):
    state = RunState(messages=[system_message(memory), {"role": "user", "content": brief(question)}])
    while state.step < max_steps:
        state.step += 1
        if keep_last:
            trim(state.messages, keep_last)
        state.sent_tokens.append(approx_tokens(state.messages))
        reply = call_model(state.messages, tools=[SEARCH_PAPERS])
        state.messages.append({"role": "assistant", **reply})
        if not reply["tool_calls"]:
            return reply["text"], state
        for call in reply["tool_calls"]:
            result = handle_tool_call(call)
            if result["status"] == "ok":
                # The host enforces remembered preferences; the prompt only explains them.
                if "year_from" in memory:
                    result["content"] = [p for p in result["content"] if p["year"] >= memory["year_from"]]
                state.seen_ids.update(p["id"] for p in result["content"])
            state.messages.append({"role": "tool", **result})
    return None, state


if __name__ == "__main__":
    if "--forget" in sys.argv:
        if os.path.exists(MEMORY_PATH):
            os.remove(MEMORY_PATH)
        print("memory cleared")
        sys.exit()
    if "--remember" in sys.argv:
        key, value = sys.argv[sys.argv.index("--remember") + 1].split("=", 1)
        remember(key, int(value) if value.isdigit() else value)

    memory = load_memory()
    print("memory:", json.dumps(memory) if memory else "(none)")
    set_quirks({"thorough"})  # five searches, so the history has time to grow
    question = "How do LLM agents interleave reasoning and tool use?"

    full_answer, full = run(question, memory)
    trimmed_answer, trimmed = run(question, memory, keep_last=2)

    print(f"\n{'call':>4}  {'tokens sent':>11}  {'keep last 2':>11}")
    for i, (a, b) in enumerate(zip(full.sent_tokens, trimmed.sent_tokens), 1):
        print(f"{i:>4}  {a:>11,}  {b:>11,}")
    total_full, total_trim = sum(full.sent_tokens), sum(trimmed.sent_tokens)
    print(f"{'all':>4}  {total_full:>11,}  {total_trim:>11,}   ({1 - total_trim / total_full:.0%} less)")
    print(f"\npapers seen this run: {len(full.seen_ids)}")
    print("answer:", full_answer)
    if trimmed_answer != full_answer:
        print("answer with trimming:", trimmed_answer)

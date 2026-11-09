"""Paper-search assistant · checkpoint 1 of 4: One model call

Turn a research question into 2-4 search queries, and check the reply
before the rest of the program relies on it.

Run:
    python checkpoint_1.py
    python checkpoint_1.py "Which benchmarks test tool-using agents?"
    python checkpoint_1.py --sloppy     # the fake model answers in prose first
"""
import json
import sys

from llm import call_model, set_quirks, set_trace

# -- 1 · One model call ---------------------------------------------------------

PLANNER = {"role": "system", "content":
           "Turn the research question into 2-4 short search queries. "
           'Reply with JSON only: {"queries": [...], "year_from": null}.'}

QUERY_SCHEMA = {
    "type": "object",
    "properties": {
        "queries": {"type": "array", "items": {"type": "string"},
                    "minItems": 2, "maxItems": 4},
        "year_from": {"type": ["integer", "null"]},
    },
    "required": ["queries"],
}


def plan_queries(question, retries=1):
    messages = [PLANNER, {"role": "user", "content": question}]
    for attempt in range(retries + 1):
        text = call_model(messages, schema=QUERY_SCHEMA)["text"]
        try:
            plan = json.loads(text)
            queries = [q.strip() for q in plan["queries"] if q.strip()]
            if not 2 <= len(queries) <= 4:
                raise ValueError("expected 2-4 non-empty queries")
            return queries
        except (json.JSONDecodeError, KeyError, TypeError, ValueError) as err:
            messages += [
                {"role": "assistant", "content": text},
                {"role": "user", "content": f"Invalid reply: {err}. JSON only."},
            ]
    raise RuntimeError("model never produced a valid query plan")


if __name__ == "__main__":
    set_trace()
    if "--sloppy" in sys.argv:
        set_quirks({"prose_first"})
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    question = args[0] if args else "How do LLM agents decide when to call a tool?"
    print("question:", question)
    print("queries: ", plan_queries(question))

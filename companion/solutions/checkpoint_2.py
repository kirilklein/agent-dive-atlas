"""Reference solution: 2a and 2b on top of checkpoint 2. Lines marked # 2a/# 2b are new."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
"""Paper-search assistant · checkpoint 2 of 4: Tool calling

Give the model a search_papers tool. The model proposes a call; the host
validates it and only then runs the tool.

Run:
    python checkpoint_2.py                        # a valid search
    python checkpoint_2.py --scenario empty       # whitespace-only query
    python checkpoint_2.py --scenario disallowed  # a tool that does not exist
"""
import json
import sys

from llm import call_model, set_quirks, set_trace
from papers import search_papers, terms

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


# -- 2 · Tool calling -----------------------------------------------------------

SEARCH_PAPERS = {
    "name": "search_papers",
    "description": "Search the paper index. Returns up to 3 papers "
                   "with id, title, year and summary. Read-only.",
    "input_schema": {
        "type": "object",
        "properties": {"query": {"type": "string", "maxLength": 200},
                       "year_from": {"type": "integer", "minimum": 1990, "maximum": 2030}},  # 2a
        "required": ["query"],
    },
}

ALLOWED_TOOLS = {"search_papers": search_papers}
MAX_QUERY = 200

def handle_tool_call(call):
    # A proposal from the model. Nothing has run yet.
    name = call["name"]
    args = call.get("arguments", {})

    if name not in ALLOWED_TOOLS:
        return error(call, "tool_not_allowed",
            f"{name!r} is not available")

    query = args.get("query")
    if not isinstance(query, str) or not query.strip():
        return error(call, "invalid_arguments",
            "query must be a non-empty string")
    if len(query) > MAX_QUERY:
        return error(call, "invalid_arguments",
            f"query is over {MAX_QUERY} characters")
    if not terms(query):  # 2b
        return error(call, "invalid_arguments",
            "query has no searchable words")
    year_from = args.get("year_from")  # 2a
    if year_from is not None and (not isinstance(year_from, int) or isinstance(year_from, bool)
                                  or not 1990 <= year_from <= 2030):
        return error(call, "invalid_arguments",
            "year_from must be a whole year from 1990 to 2030")

    papers = ALLOWED_TOOLS[name](query.strip(), limit=3)
    if year_from is not None:  # 2a
        papers = [p for p in papers if p["year"] >= year_from]
    return {"tool_call_id": call["id"],
            "status": "ok", "content": papers}

def error(call, code, msg):
    return {"tool_call_id": call["id"],
            "status": "error",
            "error": {"code": code, "message": msg}}


if __name__ == "__main__":
    set_trace()
    scenario = sys.argv[sys.argv.index("--scenario") + 1] if "--scenario" in sys.argv else "valid"
    set_quirks({"valid": set(), "empty": {"empty_query"},
                "disallowed": {"disallowed_tool"}}[scenario])
    question = "How do LLM agents decide when to call a tool?"
    messages = [
        {"role": "system", "content": "You help researchers find papers. Use search_papers."},
        {"role": "user", "content": question + "\n\nSuggested searches: "
                                    + "; ".join(plan_queries(question))},
    ]
    reply = call_model(messages, tools=[SEARCH_PAPERS])
    for call in reply["tool_calls"]:
        result = handle_tool_call(call)
        if result["status"] == "ok":
            print(f"  tool  ▸ ran, {len(result['content'])} papers:")
            for paper in result["content"]:
                print(f"            {paper['id']}  {paper['title']}")
        else:
            print(f"  tool  ▸ never ran. The model receives:")
            print("           ", json.dumps(result))

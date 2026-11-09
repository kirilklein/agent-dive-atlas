"""Check your exercise solutions.

    python check.py 2              # checks exercises 2a and 2b against checkpoint_2.py
    python check.py all
    python check.py 2 --solutions  # run the same checks against solutions/checkpoint_2.py

Each check drives your code with a scripted model, so results do not depend on
the fake model's behaviour.
"""
import contextlib
import importlib.util
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def load(n, solutions=False):
    path = os.path.join(HERE, "solutions" if solutions else "", f"checkpoint_{n}.py")
    spec = importlib.util.spec_from_file_location(f"checkpoint_{n}_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Script:
    """Stands in for call_model: planner calls get a fixed plan, tool-capable
    calls get the scripted replies in order."""

    def __init__(self, plan_replies=None, act_replies=None):
        self.plan_replies = list(plan_replies or ['{"queries": ["agents reasoning", "tool learning"]}'])
        self.act_replies = list(act_replies or [])
        self.calls = []

    def __call__(self, messages, tools=None, schema=None):
        self.calls.append([dict(m) for m in messages])
        if tools:
            reply = self.act_replies.pop(0) if self.act_replies else {"text": "Done [arXiv:2210.03629].", "tool_calls": []}
            return {"text": reply.get("text"), "tool_calls": reply.get("tool_calls", [])}
        text = self.plan_replies.pop(0) if len(self.plan_replies) > 1 else self.plan_replies[0]
        return {"text": text, "tool_calls": []}


def search(i, query, **extra):
    return {"text": None, "tool_calls": [{"id": f"t{i}", "name": "search_papers", "arguments": {"query": query, **extra}}]}


def count_tool_runs(module):
    real = module.ALLOWED_TOOLS["search_papers"]
    counter = {"n": 0}

    def wrapped(*args, **kwargs):
        counter["n"] += 1
        return real(*args, **kwargs)

    module.ALLOWED_TOOLS["search_papers"] = wrapped
    return counter


# -- checks: each returns None on success or a message saying what is wrong ------

def check_1a(m):
    m.call_model = s = Script(['{"queries": ["LLM agents", "llm  Agents "]}', '{"queries": ["agents", "tools"]}'])
    out = m.plan_queries("q")
    if out != ["agents", "tools"]:
        return f"duplicates were accepted: plan_queries returned {out}"
    if len(s.calls) != 2 or "Invalid reply" not in s.calls[1][-1]["content"]:
        return "the model should get one retry that explains the problem"


def check_1b(m):
    long_query = "how do large language model agents decide when to call a tool and how do we evaluate it"
    m.call_model = s = Script([json.dumps({"queries": [long_query, "tools"]}), '{"queries": ["agents", "tools"]}'])
    out = m.plan_queries("q")
    if out != ["agents", "tools"]:
        return "a query over 80 characters was accepted"
    if len(s.calls) != 2:
        return "the model should get one retry"


def check_2a(m):
    props = m.SEARCH_PAPERS["input_schema"]["properties"]
    if "year_from" not in props:
        return "year_from is not declared in SEARCH_PAPERS"
    runs = count_tool_runs(m)
    ok = m.handle_tool_call({"id": "a", "name": "search_papers", "arguments": {"query": "language model tool agents", "year_from": 2023}})
    if ok["status"] != "ok" or not ok["content"]:
        return "a valid year_from should return papers"
    if any(p["year"] < 2023 for p in ok["content"]):
        return "papers older than year_from were returned"
    before = runs["n"]
    for bad in ("soon", True, 1850):
        r = m.handle_tool_call({"id": "b", "name": "search_papers", "arguments": {"query": "agents", "year_from": bad}})
        if r["status"] != "error" or r["error"]["code"] != "invalid_arguments":
            return f"year_from={bad!r} should be rejected with invalid_arguments"
    if runs["n"] != before:
        return "the tool ran even though year_from was invalid"
    plain = m.handle_tool_call({"id": "c", "name": "search_papers", "arguments": {"query": "agents"}})
    if plain["status"] != "ok":
        return "searches without year_from should still work"


def check_2b(m):
    runs = count_tool_runs(m)
    r = m.handle_tool_call({"id": "a", "name": "search_papers", "arguments": {"query": "the of and"}})
    if r["status"] != "error" or r["error"]["code"] != "invalid_arguments":
        return "a stopword-only query should be rejected with invalid_arguments"
    if runs["n"]:
        return "the tool ran for a stopword-only query"
    if m.handle_tool_call({"id": "b", "name": "search_papers", "arguments": {"query": "agents"}})["status"] != "ok":
        return "ordinary queries should still work"


def check_3a(m):
    runs = count_tool_runs(m)
    m.call_model = Script(act_replies=[search(1, "agents reasoning"), search(2, "Agents  reasoning"), {"text": "Done [arXiv:2210.03629]."}])
    run = m.run_agent("q")
    errors = [x for x in run["messages"] if x["role"] == "tool" and x["status"] == "error"]
    if runs["n"] != 1:
        return f"the repeated search ran the tool {runs['n']} times; it should run once"
    if not errors or errors[0]["error"]["code"] != "duplicate_search":
        return "the repeated search should come back as an error with code duplicate_search"


def check_3b(m):
    queries = ["agents reasoning", "tool learning", "API calls", "judge evaluation", "long context", "agent memory"]
    m.call_model = Script(act_replies=[search(i, q) for i, q in enumerate(queries, 1)])
    try:
        run = m.run_agent("q", max_chars=1500)
    except TypeError:
        return "run_agent does not accept max_chars"
    if run["stop"] != "context_budget":
        return f"expected stop='context_budget', got {run['stop']!r}"
    m.call_model = Script(act_replies=[search(1, "agents"), {"text": "Done [arXiv:2210.03629]."}])
    if m.run_agent("q")["stop"] != "done":
        return "with the default budget, a short run should finish normally"


def check_4a(m):
    with open(os.path.join(HERE, "judge_labels.jsonl")) as f:
        labels = [json.loads(line) for line in f if line.strip()]
    papers = {p["id"]: p for p in m.PAPERS}
    wrong = [x["claim"] for x in labels
             if m.overlap_judge(x["claim"], papers[x["paper"]]["title"] + ". " + papers[x["paper"]]["summary"]) != x["supported"]]
    if wrong:
        return f"{len(labels) - len(wrong)}/{len(labels)} agree; still wrong on: {wrong[0]!r}"


def check_4b(m):
    if not hasattr(m, "cites_expected"):
        return "cites_expected is not defined"
    claims = [{"text": "a", "cites": "arXiv:1"}, {"text": "b", "cites": None}]
    if m.cites_expected(claims, ["arXiv:1", "arXiv:9"]) is not True:
        return "should be True when one claim cites an expected paper"
    if m.cites_expected(claims, ["arXiv:9"]) is not False:
        return "should be False when no claim cites an expected paper"
    if m.cites_expected([], ["arXiv:1"]) is not False:
        return "should be False for an answer with no claims"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    which = args[0] if args else "all"
    use_solutions = "--solutions" in sys.argv
    exercises = json.load(open(os.path.join(HERE, "exercises.json")))
    passed = 0
    for ex in exercises:
        if which != "all" and str(ex["checkpoint"]) != which:
            continue
        with contextlib.redirect_stdout(io.StringIO()):
            module = load(ex["checkpoint"], use_solutions)
            try:
                problem = globals()[f"check_{ex['id']}"](module)
            except Exception as err:  # a crash is a failed check, with the reason
                problem = f"{type(err).__name__}: {err}"
        if problem:
            print(f"✗ {ex['id']}  {ex['title']}: {problem}")
        else:
            passed += 1
            print(f"✓ {ex['id']}  {ex['title']}")
    total = sum(1 for ex in exercises if which == "all" or str(ex["checkpoint"]) == which)
    print(f"\n{passed}/{total} passing")
    sys.exit(0 if passed == total else 1)

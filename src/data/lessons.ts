import { CHECKPOINT_4_OUTPUT, CP4, REPLAY_SET, between, type CheckpointId } from './companion';
import type { RegionId } from './types';

export type Example = {
  label: string;
  language: 'python' | 'json' | 'text';
  code: string;
};

export type Interaction =
  | { kind: 'trace'; traceId: string; prompt: string }
  | { kind: 'compare' }
  | { kind: 'checkpoint'; id: CheckpointId }
  | { kind: 'tokens' }
  | { kind: 'interval' };

export type Lesson = {
  /** One concise explanation. Backticks mark inline code. */
  explanation: string;
  example?: Example;
  interaction?: Interaction;
};

type LessonKey = `${RegionId}/${string}`;

/**
 * Lesson content, keyed by region/concept. Every lesson follows the same
 * paper-search assistant, and repeats one idea: the model proposes, the host decides.
 */
export const LESSONS: Record<LessonKey, Lesson> = {
  /* I · One model call ------------------------------------------------ */
  'one-model-call/the-request': {
    explanation:
      'A model call is a function from a list of messages to one proposal. Everything the model knows about your task is in that list, and nothing carries over between calls unless you put it back. That is the idea the whole trail rests on: the model only proposes. Running tools, keeping state, checking replies and deciding when to stop all happen in your code. Wrap your provider’s SDK in one function, `call_model`, and the rest of the assistant is plain Python.',
    example: {
      label: 'assistant.py',
      language: 'python',
      code: `def call_model(messages, tools=None, schema=None):
    """Thin wrapper over your provider's SDK (see llm.py).
    Returns {"text": str | None, "tool_calls": list[dict]}."""
    ...

# The whole agent, in three lines:
#   proposal = call_model(messages)     the model proposes
#   result = host(proposal)             your code decides and acts
#   messages += [proposal, result]      and the next call sees both

messages = [
    {"role": "system", "content": "You help researchers find papers."},
    {"role": "user", "content": "How do LLM agents decide when to call a tool?"},
]
reply = call_model(messages)
print(reply["text"])`,
    },
  },
  'one-model-call/structured-output': {
    explanation:
      'Free text is for people; your program needs fields. Describe the shape you want — two to four search queries and an optional start year — and ask for JSON in exactly that shape. Many providers can enforce a schema. Either way, the schema doubles as documentation the model reads.',
    example: {
      label: 'plan.py',
      language: 'python',
      code: `QUERY_SCHEMA = {
    "type": "object",
    "properties": {
        "queries": {"type": "array", "items": {"type": "string"},
                    "minItems": 2, "maxItems": 4},
        "year_from": {"type": ["integer", "null"]},
    },
    "required": ["queries"],
}

reply = call_model(
    [{"role": "system", "content": "Turn the question into search queries. "
                                   "Reply with JSON only."},
     {"role": "user", "content": question}],
    schema=QUERY_SCHEMA,
)
# reply["text"] == '{"queries": ["LLM agents tool use", ...], "year_from": 2022}'`,
    },
  },
  'one-model-call/parse-a-reply': {
    explanation:
      'The reply is a proposal, not a value. Parse it, check every field you rely on, and decide what happens when it is wrong: here, retry once with the error message, then fail loudly. This is the first appearance of the pattern the whole trail is built on — the model proposes, the host checks.',
    interaction: {
      kind: 'trace',
      traceId: 'parse-a-reply',
      prompt: 'Pick a reply and step through what the host does with it.',
    },
  },

  /* II · Tool calling ------------------------------------------------- */
  'tool-calling/declare-a-tool': {
    explanation:
      'A tool is a name, a description, and a JSON schema for its arguments. You send these declarations with the request, and the model may answer with a tool call instead of text: a request that your code run `search_papers` with some arguments. The model never runs anything. The declaration is all it knows about the tool, so the description is part of your prompt.',
    example: {
      label: 'tools.py',
      language: 'python',
      code: `SEARCH_PAPERS = {
    "name": "search_papers",
    "description": "Search the paper index. Returns up to 3 papers "
                   "with id, title, year and summary. Read-only.",
    "input_schema": {
        "type": "object",
        "properties": {"query": {"type": "string", "maxLength": 200}},
        "required": ["query"],
    },
}

reply = call_model(messages, tools=[SEARCH_PAPERS])
reply["tool_calls"]
# [{"id": "call_01", "name": "search_papers",
#   "arguments": {"query": "LLM agents decide call tool"}}]`,
    },
  },
  'tool-calling/inspect-a-call': {
    explanation:
      'Between the model’s proposal and the tool sits one function you own: `handle_tool_call`. It checks the tool name against an allowlist and the arguments against what the tool really accepts — a schema guides the model but doesn’t bind it. Only a call that passes every check executes, and every outcome, success or rejection, goes back to the model as a structured message.',
    interaction: {
      kind: 'trace',
      traceId: 'inspect-a-call',
      prompt: 'Choose what the model proposes, then step through the host code.',
    },
  },
  'tool-calling/errors-are-results': {
    explanation:
      'When a check fails or the tool raises, don’t crash the loop and don’t drop the call silently. Return a structured error with a stable code and a message written for the model. Models recover well from specific errors — an empty query becomes a real one on the next turn — and your logs get one uniform record of what went wrong.',
    example: {
      label: 'host.py',
      language: 'python',
      code: `try:
    papers = search_papers(query=query, limit=3)
except TimeoutError:
    return error(call, "tool_timeout",
                 "search took too long; try a narrower query")

# What the model reads on its next turn:
# {"role": "tool", "tool_call_id": "call_02", "status": "error",
#  "error": {"code": "invalid_arguments",
#            "message": "query must be a non-empty string"}}`,
    },
  },

  /* III · Agent loop -------------------------------------------------- */
  'agent-loop/the-loop': {
    explanation:
      'An agent is a loop around the model call. The first message carries the question and the searches `plan_queries` suggested. Each turn sends the whole history. If the reply contains tool calls, run each through `handle_tool_call`, append the results and go again. If it contains only text, that text is the answer. The model decides what to try next; the loop decides whether it is allowed and when it stops.',
    example: {
      label: 'checkpoint_3.py',
      language: 'python',
      code: between(CP4, 'AGENT = ', '# -- 4 ·'),
    },
  },
  'agent-loop/watch-a-run': {
    explanation:
      'Two runs of `run_agent` from checkpoint 3, exactly as the fake model plays them. In the first, two searches are enough and the model answers on step 3. In the second, the budget is two steps and the model still wants to search, so the loop stops it and says why.',
    interaction: {
      kind: 'trace',
      traceId: 'watch-a-run',
      prompt: 'Pick a run and step through each turn of the loop.',
    },
  },
  'agent-loop/stop-conditions': {
    explanation:
      'There are two honest ways to stop: the model returns text without tool calls, or the host runs out of budget. Budgets can count steps, tokens, seconds or money; steps are simplest and roughly bound the rest. When the budget ends a run, say so in the result rather than passing off a half-finished draft as an answer — callers and your evaluation need to tell the two apart.',
    example: {
      label: 'cli.py',
      language: 'python',
      code: `result = run_agent("Which benchmarks test tool-using agents?", max_steps=2)

if result["stop"] == "step_budget":
    print(f"Stopped after {result['steps']} steps without an answer.")
    # show what was gathered, offer to continue, or raise the budget
else:
    print(result["answer"])`,
    },
  },

  /* IV · Evaluation --------------------------------------------------- */
  'evaluation/replay-set': {
    explanation:
      'You can’t eyeball whether a change helped. Write down a handful of real questions with papers a good answer could cite. With a fixed paper index, replays are deterministic apart from the model: same questions, same search results, so only the model’s behaviour can change between runs. Five questions is enough to find bugs and far too few to measure small improvements, as Trust the numbers shows.',
    example: { label: 'replay_set.jsonl', language: 'json', code: REPLAY_SET },
  },
  'evaluation/score-a-replay': {
    explanation:
      'Check every claim in two steps. First: is the cited paper one the assistant actually retrieved? That is a set lookup, and it catches invented IDs. Second: does the paper support the claim? That needs judgement, usually a separate model call that sees one claim and one paper summary. Offline, checkpoint 4 uses a cheap word-overlap judge instead, and measures how often it is wrong.',
    interaction: {
      kind: 'trace',
      traceId: 'score-a-replay',
      prompt: 'Pick an answer and step through how it is scored.',
    },
  },
  'evaluation/trust-the-numbers': {
    explanation:
      'Checkpoint 4 reports 11 of 12 claims supported. Two things limit what that means. First, size: with 12 claims the 95% interval runs from 65% to 99%, and one more failure would move the score by 8 points. Second, the judge: checked against twelve claims a person labelled, the offline judge agreed on 10 and passed two overstatements, and one of those is in this replay, so the real figure is 10 of 12. Check the judge before trusting it, report intervals, and keep the failing claims, because they tell you what to fix.',
    example: { label: 'python checkpoint_4.py', language: 'text', code: CHECKPOINT_4_OUTPUT },
    interaction: { kind: 'interval' },
  },

  /* Checkpoints ------------------------------------------------------ */
  'one-model-call/checkpoint': {
    explanation:
      'You now have `plan_queries`: one model call whose reply is parsed and checked before the rest of the program uses it. Copy the checkpoint and the three shared files into one folder and run it with plain Python. It needs no key, because a scripted fake model answers. Try `--sloppy` to watch the retry, then the two exercises below.',
    interaction: { kind: 'checkpoint', id: 1 },
  },
  'tool-calling/checkpoint': {
    explanation:
      'New here: a tool declaration, an allowlist and `handle_tool_call`. The model proposes a call, and `search_papers` runs only after every check passes. Run the three scenarios and compare what the model receives in each. They are the same three cases as Inspect a call. Then extend the tool in the exercises below.',
    interaction: { kind: 'checkpoint', id: 2 },
  },
  'agent-loop/checkpoint': {
    explanation:
      'New here: the agent prompt, `brief`, which reuses `plan_queries` to suggest searches, and `run_agent`. The loop itself is a dozen lines; everything else is code you already have. Run it with `--max-steps 2` to see the budget end a run. The exercises add two more ways for the host to say no.',
    interaction: { kind: 'checkpoint', id: 3 },
  },
  'evaluation/checkpoint': {
    explanation:
      'New here: claim splitting, two judges, `score`, a Wilson interval and `check_judge`. Read the output closely. The replay says 11 of 12 claims are supported, but the judge check shows the offline judge passing two overstatements, one of them in this replay. Exercise 4a fixes that.',
    interaction: { kind: 'checkpoint', id: 4 },
  },

  /* Branch runs ------------------------------------------------------- */
  'permissions/run-it': {
    explanation:
      'A search source returns a record with instructions hidden in its summary, and the fake model obeys them: it asks for `delete_library`. The host never offered that tool, so nothing happens. Saving is different: `save_to_library` exists, but only runs after a person confirms. Run it with `--save --yes` and `--save --no` to see both answers.',
    interaction: { kind: 'checkpoint', id: 'permissions' },
  },
  'context-memory/run-it': {
    explanation:
      'One question, run twice with five searches: once keeping every result, once keeping only the last two in full. The table shows tokens sent per call. Trimming saves tokens and has a price: the answer can no longer describe papers whose summaries were trimmed. Then save a preference with `--remember year_from=2023` and see the host apply it to every search.',
    interaction: { kind: 'checkpoint', id: 'memory' },
  },
  'multi-agent/run-it': {
    explanation:
      'The reviewer and the revision, running for real against the fake model on the five replay questions. The reviewer catches both planted problems. The paired comparison then shows extra calls and tokens as real differences, and citation support as “can’t tell yet”, partly because the word-overlap judge cannot see one of the fixes.',
    interaction: { kind: 'checkpoint', id: 'multi-agent' },
  },

  /* A · Permissions --------------------------------------------------- */
  'permissions/read-only-tools': {
    explanation:
      'The cheapest safety property is a capability you never grant. A paper-search assistant needs to read, so expose read-only tools. Anything that writes, sends, deletes or spends is either absent or behind a confirmation step a person completes. The system prompt can ask the model to behave; only the host’s allowlist can say no.',
    example: {
      label: 'permissions.py',
      language: 'python',
      code: `READ_ONLY = {"search_papers": search_papers, "get_abstract": get_abstract}
NEEDS_CONFIRMATION = {"save_to_library": save_to_library}

def allowed(name, confirmed_by_user=False):
    if name in READ_ONLY:
        return True
    if name in NEEDS_CONFIRMATION:
        return confirmed_by_user   # a person clicked "Save", not the model
    return False`,
    },
  },
  'permissions/untrusted-results': {
    explanation:
      'Tool results are written by strangers. An abstract or a web page can contain text that reads like instructions, and it lands in the same message list as your real ones. Assume it will sometimes work on the model. Defend where the model can’t be talked out of it: fence results as data, keep tools read-only, and validate every proposal the same way regardless of what came before.',
    interaction: {
      kind: 'trace',
      traceId: 'untrusted-results',
      prompt: 'Compare an injected result with an ordinary one.',
    },
  },

  /* B · Context & memory --------------------------------------------- */
  'context-memory/run-state': {
    explanation:
      'Inside one run, the message list is the state: the question, every proposal, every result. Keep a little structured state beside it — the step count, paper IDs already seen — so the host can decide things without re-reading prose. All of it is discarded when the run ends; nothing from this run should reach the next by accident.',
    example: {
      label: 'state.py',
      language: 'python',
      code: `@dataclass
class RunState:
    messages: list[dict]
    step: int = 0
    seen_ids: set[str] = field(default_factory=set)

    def record(self, result):
        for paper in result.get("content", []):
            self.seen_ids.add(paper["id"])   # skip repeats next search`,
    },
  },
  'context-memory/saved-memory': {
    explanation:
      'Memory across runs is a separate, small store you write to on purpose — not a replay of old transcripts. Save durable facts the user stated, like a year cutoff or a reading list, and load them into the system message when a run starts. Because it is explicit, the user can see it, edit it and delete it.',
    example: {
      label: 'memory.py',
      language: 'python',
      code: `# memory.json — written only when the user asks
# {"prefers_after": 2020, "reading_list": ["arXiv:2210.03629"]}

def system_message(memory):
    return {"role": "system", "content":
            "You help researchers find papers.\\n"
            f"Saved user preferences: {json.dumps(memory)}"}

messages = [system_message(load_memory()), {"role": "user", "content": q}]`,
    },
  },
  'context-memory/cost-of-history': {
    explanation:
      'Every call resends the whole message list. Say the system prompt and question are P tokens and each step adds r tokens (a proposal and its result). Call i then sends P + (i−1)·r tokens, and n calls send nP + r·n(n−1)/2 in total. The first term grows linearly with steps; the second grows with their square, so long runs are dominated by resending old results. Keeping only the last k results caps each call at P + k·r and makes the total linear again. Prompt caching lowers the price of a repeated prefix, but those tokens still fill the context window.',
    example: {
      label: 'trim.py',
      language: 'python',
      code: `def trim(messages, keep_last=2):
    """Shrink all but the last few tool results to id + title."""
    tool_idx = [i for i, m in enumerate(messages) if m["role"] == "tool"]
    for i in tool_idx[:-keep_last]:
        papers = messages[i].get("content") or []
        messages[i] = {**messages[i], "content": [
            {"id": p["id"], "title": p["title"]} for p in papers]}
    return messages`,
    },
    interaction: { kind: 'tokens' },
  },

  /* C · Multi-agent --------------------------------------------------- */
  'multi-agent/add-a-reviewer': {
    explanation:
      'A reviewer is a second model call with a different job and less context: the draft answer plus the abstracts it cites, asked to flag claims those abstracts don’t support. The writer revises once with that feedback. It is still one host program — the “agents” are roles with their own prompts and tools, and the reviewer gets no tools at all.',
    example: {
      label: 'review.py',
      language: 'python',
      code: `def answer_with_review(question):
    draft = run_agent(question)
    cited = {pid: INDEX[pid] for pid in citations(draft["answer"])}
    review = call_model([REVIEWER_SYSTEM, {"role": "user", "content":
                         json.dumps({"draft": draft["answer"], "papers": cited})}])
    if review["text"].strip() == "NO_ISSUES":
        return draft
    return revise(question, draft, feedback=review["text"])`,
    },
  },
  'multi-agent/compare-on-evals': {
    explanation:
      'Both setups answered the same five replay questions, so compare them question by question: pairing removes the differences between questions from the noise. Latency and cost rise on every question by similar amounts, so those differences are real. Citation accuracy rises on two questions, falls on one and is flat on two, and its 95% interval runs from −41 to +54 points. The honest result is “can’t tell yet”. If the pattern held, telling the setups apart would take roughly 130 questions.',
    interaction: { kind: 'compare' },
  },
};

export function lessonFor(region: RegionId, concept: string): Lesson | undefined {
  return LESSONS[`${region}/${concept}`];
}

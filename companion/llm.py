"""The one place that talks to a model.

    call_model(messages, tools=None, schema=None) -> {"text": str | None, "tool_calls": [...]}

Messages use a small provider-neutral format:
    {"role": "system" | "user", "content": str}
    {"role": "assistant", "text": str | None, "tool_calls": [{"id", "name", "arguments"}]}
    {"role": "tool", "tool_call_id": str, "status": "ok" | "error", "content" | "error": ...}

By default the scripted FakeModel answers, so nothing needs a key. To use Claude:

    pip install anthropic
    export ANTHROPIC_API_KEY=...
    ATLAS_MODEL=claude python checkpoint_3.py
"""

import json
import os
import re

from fake_model import FakeModel

_fake = FakeModel()
_trace = False
_shown = []  # tool messages already printed


def using_fake():
    return os.environ.get("ATLAS_MODEL", "fake") != "claude"


def set_quirks(quirks):
    """Switch on FakeModel quirks (ignored when a real model is in use)."""
    _fake.quirks = set(quirks)


def set_trace(on=True):
    """Print what the model receives and proposes on every call."""
    global _trace
    _trace = on


def call_model(messages, tools=None, schema=None):
    if _trace:
        _print_new_tool_results(messages)
    reply = _fake(messages, tools, schema) if using_fake() else _call_claude(messages, tools, schema)
    if _trace:
        _print_reply(reply)
    return reply


# -- Claude adapter -------------------------------------------------------------

def _call_claude(messages, tools, schema):
    import anthropic

    system, convo = _to_claude(messages)
    if schema:
        system += "\n\nReply with JSON only, matching this JSON schema:\n" + json.dumps(schema)
    kwargs = {
        "model": os.environ.get("ATLAS_CLAUDE_MODEL", "claude-sonnet-5-5"),
        "max_tokens": 4096,
        "system": system,
        "messages": convo,
    }
    if tools:
        kwargs["tools"] = tools
    response = anthropic.Anthropic().messages.create(**kwargs)
    text = "".join(b.text for b in response.content if b.type == "text") or None
    if schema and text:
        text = _strip_fences(text)
    calls = [{"id": b.id, "name": b.name, "arguments": b.input}
             for b in response.content if b.type == "tool_use"]
    # Keep the raw blocks (including any thinking blocks) to send back unchanged.
    raw = [b.model_dump(exclude_none=True) for b in response.content]
    return {"text": text, "tool_calls": calls, "_raw": raw}


def _strip_fences(text):
    """Models often wrap JSON in ```json fences even when asked not to."""
    match = re.match(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", text, re.S)
    return match.group(1) if match else text


def _to_claude(messages):
    """Neutral messages -> (system prompt, Claude messages)."""
    system, out = [], []
    for m in messages:
        role = m["role"]
        if role == "system":
            system.append(m["content"])
        elif role == "user":
            out.append({"role": "user", "content": m["content"]})
        elif role == "assistant":
            blocks = m.get("_raw")
            if not blocks:
                text = m.get("text") or m.get("content")
                blocks = ([{"type": "text", "text": text}] if text else []) + [
                    {"type": "tool_use", "id": c["id"], "name": c["name"], "input": c["arguments"]}
                    for c in m.get("tool_calls", [])
                ]
            out.append({"role": "assistant", "content": blocks})
        elif role == "tool":
            ok = m["status"] == "ok"
            block = {
                "type": "tool_result",
                "tool_use_id": m["tool_call_id"],
                "content": json.dumps(m["content"] if ok else m["error"]),
            }
            if not ok:
                block["is_error"] = True
            # All results for one assistant turn go in a single user message.
            prev = out[-1] if out else None
            if prev and prev["role"] == "user" and isinstance(prev["content"], list):
                prev["content"].append(block)
            else:
                out.append({"role": "user", "content": [block]})
    return "\n\n".join(system), out


# -- tracing --------------------------------------------------------------------

def flush_trace(messages):
    """Print tool results the model has not been shown yet (e.g. after the last step)."""
    if _trace:
        _print_new_tool_results(messages)


def _print_new_tool_results(messages):
    for m in messages:
        if m["role"] != "tool" or any(m is s for s in _shown):
            continue
        _shown.append(m)
        content = m.get("content")
        label = "ok"
        if isinstance(content, dict) and "untrusted_tool_result" in content:
            content, label = content["untrusted_tool_result"], "ok, marked untrusted"
        if m["status"] == "ok" and isinstance(content, list):
            ids = ", ".join(p["id"] for p in content) or "no matches"
            print(f"  host  ▸ {m['tool_call_id']} {label}: {ids}")
        elif m["status"] == "ok":
            print(f"  host  ▸ {m['tool_call_id']} ok: {json.dumps(m['content'])}")
        else:
            print(f"  host  ▸ {m['tool_call_id']} rejected: {m['error']['code']} ({m['error']['message']})")


def _print_reply(reply):
    for c in reply["tool_calls"]:
        args = ", ".join(f"{k}={v!r}" for k, v in c["arguments"].items())
        print(f"  model ▸ {c['id']} proposes {c['name']}({args})")
    if reply["text"] and not reply["tool_calls"]:
        text = reply["text"] if len(reply["text"]) < 90 else reply["text"][:87] + "…"
        print(f"  model ▸ replies: {text!r}")

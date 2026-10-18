#!/usr/bin/env python3
"""Validates the "Blocked on the decider" section of work/OPEN-WORK.md against
SR-WORK-OPEN-QUEUE rule 45a: when the inbox table carries no rows, the line
directly beneath it is exactly one `*Empty since YYYY-MM-DD ...*` declaration
and nothing else; when it carries rows, nothing follows them.

Read-only. Exits 0 (silent) if well-formed or absent; exits 1 with a one-line
reason on stdout if not. This script states no rule of its own.
"""
import re
import sys
from pathlib import Path

HEADING = "## Blocked on the decider"
EMPTY_RE = re.compile(r"^\*Empty since \d{4}-\d{2}-\d{2}\b.*\*$")


def find_repo_root(start: Path):
    p = start.resolve()
    for candidate in [p, *p.parents]:
        if (candidate / "work" / "OPEN-WORK.md").is_file():
            return candidate
    return None


def paragraphs(lines):
    out, cur = [], []
    for l in lines:
        if l.strip():
            cur.append(l)
        elif cur:
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def check(open_work: Path):
    lines = open_work.read_text().splitlines()
    try:
        start = next(i for i, l in enumerate(lines) if l.strip() == HEADING)
    except StopIteration:
        return None
    try:
        end = start + 1 + next(i for i, l in enumerate(lines[start + 1:]) if l.strip() == "---")
    except StopIteration:
        return f"rule 45a: '{HEADING}' has no closing '---' — section is unterminated"

    paras = paragraphs(lines[start + 1:end])
    if not paras or not paras[0][0].startswith("|") or len(paras[0]) < 2 or not paras[0][1].startswith("|"):
        return "rule 45a: the inbox is missing its table header/separator row"

    table = paras[0]
    rows = table[2:]
    rest = paras[1:]

    if rows and all(l.startswith("|") for l in rows) and not rest:
        return None
    if not rows and not rest:
        return "rule 45a: the inbox table is empty but has no '*Empty since YYYY-MM-DD ...*' declaration beneath it"
    if not rows and len(rest) == 1:
        sentence = " ".join(l.strip() for l in rest[0])
        if EMPTY_RE.match(sentence):
            return None
    found = " / ".join(" ".join(p) for p in ([rows] if rows else []) + rest)
    return ("rule 45a: the inbox carries content beyond the table and its one "
            "'*Empty since YYYY-MM-DD ...*' line — found: " + repr(found))


def main():
    root = find_repo_root(Path.cwd())
    if root is None:
        return 0
    open_work = root / "work" / "OPEN-WORK.md"
    if not open_work.is_file():
        return 0
    error = check(open_work)
    if error is None:
        return 0
    print(f"work/OPEN-WORK.md — {error} (see records/0051_WORK-open-queue.md rule 45a)")
    return 1


if __name__ == "__main__":
    sys.exit(main())

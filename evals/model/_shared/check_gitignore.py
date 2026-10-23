"""Hidden checker for the model/ eval group.

Builds fixture trees, asks git which files each .gitignore ignores, and compares the
candidate `gitignore_match.is_ignored` against git. Git is the oracle, so the expected
answers never live on disk where the engineer could read them.

Run from the eval workspace (the directory holding gitignore_match.py). Prints one line per
scenario, a RESULT line, and ALL_PASS when every check agrees with git.
"""

import importlib.util
import os
import subprocess
import sys
import tempfile

SCENARIOS = {
    "basics": (
        "*.log\n!keep.log\nbuild/\n/root-only.txt\ndocs/*.tmp\n",
        [
            "a.log", "keep.log", "sub/keep.log", "sub/x.log", "build/out.o",
            "src/build/y.o", "lib/build", "root-only.txt", "sub/root-only.txt",
            "docs/a.tmp", "docs/deep/b.tmp", "other/docs/c.tmp", "readme.md",
        ],
    ),
    "double-star": (
        "**/logs\n**/cache/**\na/**/z.txt\nfoo/**\n",
        [
            "logs/1", "x/y/logs/2", "cache/c1", "p/cache/q/c2", "a/z.txt", "a/b/z.txt",
            "a/b/c/z.txt", "b/a/z.txt", "foo/bar", "foo/sub/baz", "xfoo/bar",
            "cachex/1", "mylogs/1",
        ],
    ),
    "parent-exclusion": (
        "dist/\n!dist/keep.txt\ntmp/*\n!tmp/keep.txt\n",
        [
            "dist/keep.txt", "dist/out.js", "tmp/keep.txt", "tmp/other", "tmp/sub/f",
            "src/dist/x", "tmpfile",
        ],
    ),
    "escapes-and-spaces": (
        "# comment\n\\#hash.txt\n\\!bang.txt\ntrail.txt   \nesc\\ .txt\n[abc].dat\n?.one\n*.[0-9]\n\n",
        [
            "#hash.txt", "!bang.txt", "trail.txt", "esc .txt", "a.dat", "b.dat", "d.dat",
            "x.one", "xy.one", "f.1", "f.a", "comment",
        ],
    ),
    "allowlist": (
        "*\n!*/\n!*.py\nsecret/*.py\n!secret/public.py\n",
        [
            "a.py", "a.txt", "sub/b.py", "sub/c.txt", "secret/s.py", "secret/public.py",
            "deep/er/x.py", "deep/er/y.md",
        ],
    ),
    "anchoring": (
        "/a/b\nc/d\ne\n**/f/g\nh/\n",
        [
            "a/b", "x/a/b", "c/d/1", "x/c/d/1", "e", "q/e", "e2/1", "ee", "f/g",
            "k/f/g", "h/1", "k/h/2", "hh/3", "m/e/inside",
        ],
    ),
    "classes-and-negation": (
        "[!a-c]*.cfg\n*.bak\n!important.bak\nold/\n",
        [
            "a1.cfg", "d1.cfg", "z.cfg", "sub/b.cfg", "sub/e.cfg", "x.bak",
            "important.bak", "old/important.bak", "sub/important.bak",
        ],
    ),
    "reinclude-dirs": (
        "/*\n!/keep/\n/keep/*\n!/keep/inner/\n",
        [
            "top.txt", "other/x", "keep/a", "keep/inner/b", "keep/inner/deep/c",
            "keep/other/d",
        ],
    ),
    "star-edges": (
        "**/tmp/**/*.o\ndocs/**\n!docs/**/\n!docs/**/*.md\n*.min.*\ntrail\\ \na\\\\b\n",
        [
            "tmp/x.o", "src/tmp/y/z.o", "tmpx/a.o", "tmp/x.c", "docs/a.txt", "docs/a.md",
            "docs/sub/b.md", "docs/sub/c.txt", "app.min.js", "min.js", "trail ", "trail",
            "a\\b", "ab",
        ],
    ),
}

GIT_ENV = {
    **os.environ,
    "GIT_CONFIG_NOSYSTEM": "1",
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_TERMINAL_PROMPT": "0",
}


def git_ignored(gitignore: str, files: list[str]) -> set[str]:
    with tempfile.TemporaryDirectory() as root:
        subprocess.run(["git", "init", "-q", root], check=True, env=GIT_ENV)
        subprocess.run(
            ["git", "-C", root, "config", "core.ignorecase", "false"], check=True, env=GIT_ENV
        )
        with open(os.path.join(root, ".gitignore"), "w", encoding="utf-8") as fh:
            fh.write(gitignore)
        for rel in files:
            full = os.path.join(root, *rel.split("/"))
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as fh:
                fh.write("x\n")
        out = subprocess.run(
            ["git", "-C", root, "ls-files", "--others", "--ignored", "--exclude-standard", "-z"],
            check=True, capture_output=True, env=GIT_ENV,
        ).stdout.decode("utf-8")
        return {p for p in out.split("\0") if p}


def load_candidate():
    path = os.path.join(os.getcwd(), "gitignore_match.py")
    spec = importlib.util.spec_from_file_location("gitignore_match", path)
    module = importlib.util.module_from_spec(spec)
    # Register before executing: dataclasses and typing look the module up in sys.modules.
    sys.modules["gitignore_match"] = module
    spec.loader.exec_module(module)
    return module.is_ignored


def main() -> int:
    try:
        is_ignored = load_candidate()
    except Exception as exc:  # missing file, syntax error, missing function
        print(f"LOAD_ERROR: {type(exc).__name__}: {exc}")
        print("RESULT: 0/0 passed")
        return 1

    total = passed = 0
    for name, (gitignore, files) in SCENARIOS.items():
        expected = git_ignored(gitignore, files)
        misses = []
        for rel in files:
            want = rel in expected
            try:
                got = bool(is_ignored(gitignore, rel))
            except Exception as exc:
                got = f"raised {type(exc).__name__}"
            total += 1
            if got == want:
                passed += 1
            else:
                misses.append(f"{rel!r} want={want} got={got}")
        status = "PASS" if not misses else "FAIL"
        print(f"SCENARIO {name}: {status} ({len(files) - len(misses)}/{len(files)})")
        for miss in misses:
            print(f"  {miss}")

    print(f"RESULT: {passed}/{total} passed")
    if passed == total:
        print("ALL_PASS")
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())

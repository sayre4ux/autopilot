"""Smoke tests for workers/autopilot-worker: argv safety, timeout seams, and meta.json."""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
RUNNER = REPO / "workers" / "autopilot-worker"

PRINT_ARGV = "import sys, json; print(json.dumps(sys.argv[1:]))"
SLEEP_THEN_PRINT = "import sys, time; time.sleep(float(sys.argv[1])); print('done')"


def make_workspace(tmp_path, cli, brief_text="brief body", git=False, output=None):
    """Build an isolated HOME + workdir + registry record and return the run() inputs."""
    home = tmp_path / "home"
    (home / ".autopilot" / "workers").mkdir(parents=True)
    workdir = tmp_path / "workdir"
    workdir.mkdir()
    out_dir = tmp_path / "out"
    out_dir.mkdir()

    record = {
        "id": "test-worker",
        "type": "cli",
        "capabilities": ["code"],
        "trusted": True,
        "cli": {
            "promptDelivery": "arg",
            "successExitCodes": [0],
            **cli,
        },
    }
    if output is not None:
        record["output"] = output
    registry = workdir / ".autopilot" / "workers"
    registry.mkdir(parents=True)
    (registry / "test-worker.json").write_text(json.dumps(record), encoding="utf-8")

    brief = tmp_path / "T-1.md"
    brief.write_text(brief_text, encoding="utf-8")

    if git:
        env = {
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "HOME": str(home),
            "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
            "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com",
        }
        (workdir / "seed.txt").write_text("seed\n", encoding="utf-8")
        (workdir / ".gitignore").write_text(".autopilot/\n", encoding="utf-8")
        for args in (["init", "-q"], ["add", "-A"], ["commit", "-qm", "init"]):
            subprocess.run(["git", *args], cwd=workdir, env=env, check=True, timeout=30)

    return home, workdir, out_dir, brief


def run_worker(home, workdir, out_dir, brief, extra_args=()):
    argv = [
        sys.executable, str(RUNNER), "run", "test-worker",
        "--brief", str(brief), "--workdir", str(workdir),
        "--out", str(out_dir), "--yes", *extra_args,
    ]
    env = {
        "PATH": "/usr/bin:/bin:/usr/local/bin",
        "HOME": str(home),
        "GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@example.com",
        "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@example.com",
    }
    completed = subprocess.run(argv, capture_output=True, text=True, timeout=120, env=env)
    meta_path = out_dir / "T-1.meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8")) if meta_path.is_file() else None
    out_path = out_dir / "T-1.out"
    output = out_path.read_text(encoding="utf-8") if out_path.is_file() else None
    return completed, meta, output


def test_placeholders_become_separate_argv_entries_without_shell_interpretation(tmp_path):
    injection = "hello world; rm -rf / && echo pwned $(whoami) `id` $HOME"
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {
            "command": "python3",
            "args": ["-c", PRINT_ARGV, "${task_id}", "${prompt}", "${workdir}"],
            "timeoutSec": 60,
        },
        brief_text=injection,
    )
    completed, meta, output = run_worker(home, workdir, out_dir, brief)

    assert completed.returncode == 0, completed.stderr
    assert json.loads(output) == ["T-1", injection, str(workdir)]
    assert meta["exit"] == 0
    assert not (workdir / "pwned").exists()
    # The whole prompt stayed one argv entry, so the runner had to quote it back.
    assert "'hello world; rm -rf /" in meta["resolvedCommand"]


def test_registry_timeout_is_honored_when_no_flag_is_given(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {"command": "python3", "args": ["-c", SLEEP_THEN_PRINT, "30"], "timeoutSec": 1},
    )
    completed, meta, _ = run_worker(home, workdir, out_dir, brief)

    assert completed.returncode == 124
    assert meta["timedOut"] is True
    assert meta["durationSec"] < 15
    assert "timed out after 1s" in completed.stderr


def test_timeout_flag_overrides_a_shorter_registry_timeout(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {"command": "python3", "args": ["-c", SLEEP_THEN_PRINT, "2"], "timeoutSec": 1},
    )
    completed, meta, output = run_worker(home, workdir, out_dir, brief, ["--timeout", "60"])

    assert completed.returncode == 0, completed.stderr
    assert meta["timedOut"] is False
    assert output.strip() == "done"


def test_timeout_flag_overrides_a_longer_registry_timeout(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {"command": "python3", "args": ["-c", SLEEP_THEN_PRINT, "30"], "timeoutSec": 3600},
    )
    completed, meta, _ = run_worker(home, workdir, out_dir, brief, ["--timeout", "1"])

    assert completed.returncode == 124
    assert meta["timedOut"] is True
    assert meta["durationSec"] < 15


def test_successful_run_writes_a_complete_manifest_in_a_git_workdir(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {
            "command": "python3",
            "args": [
                "-c",
                "open('artifact.txt','w').write('x'); "
                "open('seed.txt','a').write('more'); print('ok')",
            ],
            "timeoutSec": 60,
        },
        git=True,
    )
    completed, meta, output = run_worker(home, workdir, out_dir, brief)

    assert completed.returncode == 0, completed.stderr
    assert output.strip() == "ok"
    assert meta["exit"] == 0
    assert meta["timedOut"] is False
    assert meta["worker"] == "test-worker"
    assert meta["manifestComplete"] is True
    assert len(meta["baselineRef"]) == 40
    assert meta["changedFiles"] == ["seed.txt"]
    assert meta["untrackedFiles"] == ["artifact.txt"]
    assert meta["callback"] is None
    assert meta["durationSec"] > 0


def test_unknown_worker_id_is_a_registry_error(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path, {"command": "python3", "args": ["-c", "pass"], "timeoutSec": 60}
    )
    argv = [
        sys.executable, str(RUNNER), "run", "no-such-worker",
        "--brief", str(brief), "--workdir", str(workdir), "--out", str(out_dir), "--yes",
    ]
    completed = subprocess.run(
        argv, capture_output=True, text=True, timeout=60,
        env={"PATH": "/usr/bin:/bin:/usr/local/bin", "HOME": str(home)},
    )
    assert completed.returncode == 3
    assert "unknown worker id" in completed.stderr


def test_nonzero_worker_exit_is_worker_failed(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {
            "command": "python3",
            "args": ["-c", "import sys; print('partial'); sys.exit(7)"],
            "timeoutSec": 60,
        },
    )
    completed, meta, _ = run_worker(home, workdir, out_dir, brief)

    assert completed.returncode == 2
    assert meta["exit"] == 7
    assert meta["timedOut"] is False


WORKTREE_OUTPUT = {"channel": "worktree", "format": "text", "resultPointer": "**/*"}
WRITE_DOTFILE = (
    "import pathlib; d = pathlib.Path('.github/workflows'); d.mkdir(parents=True); "
    "(d / 'ci.yml').write_text('on: push\\n')"
)
DELETE_TRACKED = "import pathlib; pathlib.Path('seed.txt').unlink()"
WRITE_IGNORED_ONLY = (
    "import pathlib; d = pathlib.Path('.autopilot/junk'); d.mkdir(parents=True); "
    "(d / 'noise.pyc').write_text('bytecode')"
)


def test_worktree_channel_reports_a_change_confined_to_a_dot_directory(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {"command": "python3", "args": ["-c", WRITE_DOTFILE], "cwd": "${workdir}", "timeoutSec": 60},
        git=True,
        output=WORKTREE_OUTPUT,
    )
    completed, meta, output = run_worker(home, workdir, out_dir, brief)

    assert completed.returncode == 0, completed.stderr
    assert ".github/workflows/ci.yml" in output
    assert meta["outputBytes"] > 0
    # Repository internals are never work product, however the pointer is written.
    assert ".git/" not in output


def test_worktree_channel_reports_a_deletion_instead_of_empty_output(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {"command": "python3", "args": ["-c", DELETE_TRACKED], "cwd": "${workdir}", "timeoutSec": 60},
        git=True,
        output=WORKTREE_OUTPUT,
    )
    completed, meta, output = run_worker(home, workdir, out_dir, brief)

    assert completed.returncode == 0, completed.stderr
    assert "deleted: seed.txt" in output
    assert meta["outputBytes"] > 0


def test_worktree_channel_does_not_accept_vcs_ignored_files_as_output(tmp_path):
    home, workdir, out_dir, brief = make_workspace(
        tmp_path,
        {"command": "python3", "args": ["-c", WRITE_IGNORED_ONLY], "cwd": "${workdir}", "timeoutSec": 60},
        git=True,
        output=WORKTREE_OUTPUT,
    )
    completed, meta, output = run_worker(home, workdir, out_dir, brief)

    # The worker exited 0 but produced only ignored build noise: that is a failed dispatch.
    assert completed.returncode == 2
    assert meta["exit"] == 0
    assert meta["outputBytes"] == 0
    assert "expectedOutput=False" in completed.stderr
    assert "noise.pyc" not in (output or "")

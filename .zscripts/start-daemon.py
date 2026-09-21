#!/usr/bin/env python3
"""Double-fork daemon: starts `next dev` reparented to init (PID 1) so it
survives the parent shell exiting. Logs to dev.log."""
import os, sys, subprocess, signal

PROJECT = "/home/z/my-project"
LOG = os.path.join(PROJECT, "dev.log")

def daemonize():
    # First fork
    if os.fork() > 0:
        sys.exit(0)
    # Decouple from parent environment
    os.setsid()
    os.umask(0)
    # Second fork
    if os.fork() > 0:
        sys.exit(0)
    # Redirect stdin/stdout/stderr
    sys.stdout.flush()
    sys.stderr.flush()
    with open(os.devnull, 'r') as devnull_in:
        os.dup2(devnull_in.fileno(), 0)
    logf = open(LOG, 'a', buffering=1)
    os.dup2(logf.fileno(), 1)
    os.dup2(logf.fileno(), 2)

def main():
    daemonize()
    # Write a marker so we can confirm the daemon reached this point
    sys.stderr.write("=== daemon reparented to init, launching next dev ===\n")
    sys.stderr.flush()
    env = dict(os.environ)
    env["NEXT_TELEMETRY_DISABLED"] = "1"
    # Strip DB URLs so Next.js loads them from .env.local / .env (not the
    # inherited shell env, which may have a stale value from a previous command).
    env.pop("DATABASE_URL", None)
    env.pop("DATABASE_URL_UNPOOLED", None)
    # exec next dev — replaces the daemon process
    os.execvpe("node_modules/.bin/next", ["next", "dev", "-p", "3000"], env)

if __name__ == "__main__":
    main()

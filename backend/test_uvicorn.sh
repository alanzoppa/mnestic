#!/bin/bash
cd /Users/alan.zoppa/dev/notes-browser/backend
.venv/bin/python -m uvicorn main:app --host 127.0.0.1 --port 8000 --log-level info --no-access-log

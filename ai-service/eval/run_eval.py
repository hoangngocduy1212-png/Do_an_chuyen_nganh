"""Chạy golden set qua /internal/chat/messages và chấm đúng/sai.

  python eval/run_eval.py                 # toàn bộ
  python eval/run_eval.py --limit 5       # chạy thử
"""
import argparse, json, os, time, urllib.request
from pathlib import Path

BASE = "http://127.0.0.1:8000"
TOKEN = os.environ.get("SERVICE_TOKEN", "local-dev-service-token")


def ask(question: str) -> tuple[str, float]:
    body = json.dumps({"message": question}).encode()
    req = urllib.request.Request(
        f"{BASE}/internal/chat/messages", data=body,
        headers={"Content-Type": "application/json", "X-Service-Token": TOKEN, "X-User-Id": "eval-user"},
    )
    started = time.time()
    with urllib.request.urlopen(req, timeout=120) as res:
        data = json.load(res)
    return data.get("reply", ""), round(time.time() - started, 2)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default="eval/golden.jsonl")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--offset", type=int, default=0)
    args = ap.parse_args()
    rows = [json.loads(l) for l in Path(args.file).read_text(encoding="utf-8").splitlines() if l.strip()]
    rows = rows[args.offset: args.offset + args.limit if args.limit else None]
    results = []
    for row in rows:
        try:
            reply, secs = ask(row["question"])
            low = reply.lower()
            compact = low.replace(".", "").replace(",", "").replace(" ", "")
            ok_all = all(
                (x.lower() in low) or (x.lower().replace(".", "").replace(",", "").replace(" ", "") in compact)
                for x in row.get("all_of", [])
            )
            ok_any = not row.get("any_of") or any(x.lower() in low for x in row["any_of"])
            passed = ok_all and ok_any
            results.append({"id": row["id"], "category": row["category"], "passed": passed, "seconds": secs, "reply": reply})
        except Exception as exc:
            results.append({"id": row["id"], "category": row["category"], "passed": False, "seconds": 0, "reply": f"ERROR {exc}"})
        print(json.dumps(results[-1], ensure_ascii=False)[:300], flush=True)
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    print(json.dumps({
        "total": total, "passed": passed,
        "accuracy": round(passed / total, 3) if total else 0,
        "avg_seconds": round(sum(r["seconds"] for r in results) / total, 2) if total else 0,
    }, ensure_ascii=False))
    Path("eval/last_results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()

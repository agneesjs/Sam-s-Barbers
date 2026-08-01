#!/usr/bin/env python3
"""
update-rating.py — refreshes rating.json for the Sam's Barbers website.

Fetches the Booksy business page, extracts the current average rating
and review count, and writes them to rating.json next to index.html.
The website loads rating.json at runtime and updates every rating /
review counter on the page automatically.

Requirements: Python 3.7+ (standard library only — no pip installs).

Run it on a schedule, e.g.:

  * cron (Linux server / VPS), every hour at :07:
      7 * * * *  cd /var/www/samsbarbers && /usr/bin/python3 update-rating.py >> rating.log 2>&1

  * GitHub Actions (if the site is hosted on GitHub Pages): run this
    script on a schedule and commit rating.json when it changes.

  * Netlify/Vercel: any small serverless cron that rebuilds/rewrites
    this one file works the same way.

Exit code is non-zero when the rating could not be read, so the
scheduler can alert you if Booksy ever changes their page markup.
"""

import json
import re
import sys
import urllib.request
from datetime import datetime, timezone

BOOKSY_URL = "https://booksy.com/en-gb/174987_sam-s-barbers_barber_1276035_birmingham"
OUT_FILE = "rating.json"

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


def fetch_html(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return res.read().decode("utf-8", errors="ignore")


def as_int(text: str) -> int:
    return int(re.sub(r"[^\d]", "", text))


def parse_rating(html: str) -> tuple:
    """Return (rating, review_count) using several fallback strategies."""

    # 1) JSON-LD structured data: aggregateRating { ratingValue, reviewCount }
    for block in re.findall(
        r'<script[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html,
        re.S | re.I,
    ):
        try:
            data = json.loads(block.strip())
        except (json.JSONDecodeError, ValueError):
            continue
        for item in data if isinstance(data, list) else [data]:
            if not isinstance(item, dict):
                continue
            agg = item.get("aggregateRating") or {}
            rating = agg.get("ratingValue")
            count = agg.get("reviewCount")
            if rating is not None and count:
                return f"{float(str(rating)):.1f}", as_int(str(count))

    # 2) Next.js page data: "average_rating":5, "reviews_count":117
    rating_m = re.search(r'"average_rating"\s*:\s*"?([0-9.]+)"?', html)
    count_m = re.search(r'"reviews_count"\s*:\s*(\d+)', html)
    if rating_m and count_m:
        return f"{float(rating_m.group(1)):.1f}", int(count_m.group(1))

    # 3) Visible text on the page, e.g. "5.0|117 reviews"
    m = re.search(r"([0-9]+(?:\.[0-9]+)?)\s*[^0-9]{0,6}\s*(\d[\d,]*)\s*reviews", html)
    if m:
        return f"{float(m.group(1)):.1f}", as_int(m.group(2))

    raise ValueError("Could not find rating data on the Booksy page.")


def main() -> int:
    try:
        html = fetch_html(BOOKSY_URL)
        rating, reviews = parse_rating(html)
    except Exception as exc:  # noqa: BLE001 — report any failure, exit non-zero
        print(f"[update-rating] ERROR: {exc}", file=sys.stderr)
        return 1

    payload = {
        "rating": rating,
        "reviews": reviews,
        "updated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": BOOKSY_URL,
    }
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")

    print(f"[update-rating] OK — {OUT_FILE}: {rating} from {reviews} reviews")
    return 0


if __name__ == "__main__":
    sys.exit(main())

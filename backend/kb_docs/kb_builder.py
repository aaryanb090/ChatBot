#!/usr/bin/env python3
import os, re, json
from collections import defaultdict

# 1) Configuration: how many entries per product
BREAKPOINTS = [
    ("smart_lighting", 12),
    ("track_lighting", 12),
    ("ceiling_lights", 6),
    ("lightstrips", 15),
    ("support", None),      # “all remaining”
]

RAW_FILE = "raw_kb.txt"
BASE = os.path.dirname(__file__)

def slugify(text):
    s = text.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s).strip('-')
    return s[:50]

# 2) Read & split raw into Q&A blocks
with open(os.path.join(BASE, RAW_FILE), encoding="utf-8") as f:
    lines = [l.rstrip() for l in f if l.strip()]

entries = []
q, a = None, []
for line in lines:
    if line.endswith('?'):
        if q:
            entries.append((q, "\n".join(a)))
        q, a = line, []
    else:
        a.append(line)
if q:
    entries.append((q, "\n".join(a)))

# 3) Assign each entry to a product folder by index
counters = defaultdict(int)
idx = 0
for question, answer in entries:
    # figure out which bucket we’re in
    remaining = idx
    for name, count in BREAKPOINTS:
        if count is None or remaining < count:
            product = name
            # decrement remaining if not the last bucket
            if count is not None:
                BREAKPOINTS[BREAKPOINTS.index((name,count))] = (name, count-1)
            break
        remaining -= count

    # increment that product’s counter
    counters[product] += 1
    num = counters[product]

    # build filename & front-matter
    eid      = f"{product}-{num:03d}"
    slug     = slugify(question)
    fname    = f"{num:03d}-{slug}.md"
    fm = [
        '---',
        f'id:       {eid}',
        f'product:  {product}',
        f'category: general',
        f'tags:     []',
        f'question: "{question}"',
        '---',
        '',
        answer
    ]

    # ensure folder exists & write
    outdir = os.path.join(BASE, product)
    os.makedirs(outdir, exist_ok=True)
    with open(os.path.join(outdir, fname), 'w', encoding='utf-8') as o:
        o.write("\n".join(fm))

    idx += 1

print("✅ Done: Markdown Q&A files generated in each product folder.")

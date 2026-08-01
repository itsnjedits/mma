#!/usr/bin/env python3
"""
============================================================
 generate_json.py — MMA Resource JSON Generator
 Ministry of Mechanical Affairs  (v6 — Local Scan Edition)
============================================================

USAGE:
    python generate_json.py

OUTPUT:
    resources.json   (in the same folder as this script)

HOW IT WORKS (v6 vs v5):
  v5 fetched everything from GitHub via the REST API (2+ calls
  per repo, rate-limited).
  v6 scans the LOCAL copies of the semester repos on disk instead
  — no network calls, no rate limits, instant re-runs.

  The JSON SCHEMA and the frontend (script.js) are UNCHANGED, and
  the path values are STILL absolute raw GitHub URLs, e.g.:
  "https://raw.githubusercontent.com/itsnjedits/3sem/main/KOM/file.pdf"

  Why keep GitHub URLs if we're scanning locally?  Because the
  live site is served from GitHub Pages and loads files straight
  from raw.githubusercontent.com. The local folders are just your
  working copies of those same repos — scanning them on disk is
  simply a faster/offline way to build the same JSON that used to
  require hitting the GitHub API.

LOCAL FOLDER LAYOUT (auto-detected):
  LOCAL_BASE_DIR/
    3sem/       ─┐
    4sem/        ├─ one folder per semester = one GitHub repo (same name)
    7sem/       ─┘
    other stuff/  ← anything NOT matching "<number>sem" is skipped
    ...more added later, same base folder, auto-detected

  The script does NOT use a hardcoded semester list any more.
  It looks inside LOCAL_BASE_DIR and picks out ONLY the subfolders
  whose name matches "<number>sem" (any case) — 3sem, 4sem, 7sem,
  1sem, 8sem, etc. Every other folder in LOCAL_BASE_DIR is skipped
  and never traversed. It figures out "kitne semester hai" (how
  many there are) by itself — add a new "<n>sem" folder (+ push it
  to GitHub as a same-named repo) and it just shows up next run.

ADDING NEW SEMESTERS:
  1. Create a new folder inside LOCAL_BASE_DIR named "<n>sem",
     e.g. "6sem".
  2. Push that same folder to GitHub as a repo named "6sem"
     under GITHUB_OWNER (so the raw URLs resolve correctly).
  3. Re-run this script. Push the updated resources.json.

JSON SCHEMA (unchanged since v4/v5 — frontend-compatible):
  Folders:  { name, type:"folder",  children:[...] }
  PDFs:     { name, type:"pdf",     path:"https://raw.github..." }
  PPTX:     { name, type:"ppt",     path:"https://raw.github..." }
  DOCX:     { name, type:"docx",    path:"https://raw.github..." }
  Images:   { name, type:"image",   path:"https://raw.github..." }
  Links:    { name, type:"link",    thumbnail:"https://...",
                                    txt:"https://...",
                                    link:"https://youtube..." }

LINK DETECTION (same logic as v4/v5):
  <stem>.txt  +  <stem>.jpg   (same stem, any image ext)
    → type:"link"
       thumbnail = raw URL of the image
       txt       = raw URL of the .txt   (runtime fallback)
       link      = URL baked from .txt content at build time
                   (read straight off disk now, instead of via
                   the GitHub Blob API)
  .txt with no paired image → silently ignored
============================================================
"""

import os
import json
import re
import urllib.parse
from collections import defaultdict
from typing import Any, Dict, List


# ── ① CONFIGURATION — edit this block before running ──────────────────────

# Folder that contains one subfolder per semester (each subfolder is the
# local copy of that semester's GitHub repo). From your screenshot:
#   This PC > New Volume (Y:) > WEB DEVELOPMENT > 3sem / 4sem / 5sem
LOCAL_BASE_DIR: str = r'Y:\WEB DEVELOPMENT'

# GitHub owner and branch used to bake raw.githubusercontent.com URLs.
# Each semester subfolder name is assumed to be the repo name too
# (e.g. local folder "3sem"  →  github.com/itsnjedits/3sem).
GITHUB_OWNER:  str = 'itsnjedits'
GITHUB_BRANCH: str = 'main'

OUTPUT_FILE = 'resources.json'

# ── ② FILE TYPE SETS ───────────────────────────────────────────────────────

IMAGE_EXTS: frozenset = frozenset({'.jpg', '.jpeg', '.png', '.webp', '.gif'})
PDF_EXTS:   frozenset = frozenset({'.pdf'})
PPTX_EXTS:  frozenset = frozenset({'.pptx'})
DOCX_EXTS:  frozenset = frozenset({'.docx'})

RAW_BASE = 'https://raw.githubusercontent.com'


# ── ③ NAME PRETTIFICATION (identical to v4/v5) ─────────────────────────────

def prettify_name(raw_name: str) -> str:
    """
    Convert a file/folder name to a readable display title.

    fluid_mechanics_notes   → Fluid Mechanics Notes
    BernoulliTheorem        → Bernoulli Theorem
    KOM 3rd SEM.pdf         → Kom 3Rd Sem  (title-cased)
    """
    stem = os.path.splitext(raw_name)[0]
    stem = re.sub(r'[_\-]+', ' ', stem)
    stem = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', stem)
    return re.sub(r'\s+', ' ', stem).strip().title()


def ordinal_semester_name(folder_name: str) -> str:
    """
    Turn a semester folder name into a display label.

    "3sem"  → "3rd Sem"
    "4sem"  → "4th Sem"
    "10sem" → "10th Sem"
    Falls back to prettify_name() if no leading number is found.
    """
    match = re.match(r'^(\d+)', folder_name)
    if not match:
        return prettify_name(folder_name)

    num = int(match.group(1))
    if 10 <= (num % 100) <= 20:
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(num % 10, 'th')
    return f'{num}{suffix} Sem'


def make_raw_url(owner: str, repo: str, branch: str, rel_path: str) -> str:
    """
    Build a raw.githubusercontent.com URL with proper per-segment encoding.

    Example:
        owner='itsnjedits', repo='3sem', branch='main',
        rel_path='KOM/Theory of Machines I.jpg'
        → 'https://raw.githubusercontent.com/itsnjedits/3sem/main/
           KOM/Theory%20of%20Machines%20I.jpg'
    """
    encoded_path = '/'.join(
        urllib.parse.quote(seg, safe='') for seg in rel_path.split('/')
    )
    return f'{RAW_BASE}/{owner}/{repo}/{branch}/{encoded_path}'


def join_rel(rel_path: str, name: str) -> str:
    """Join a URL-style relative path with a filename (always forward slashes)."""
    return f'{rel_path}/{name}' if rel_path else name


def read_link_from_txt(abs_path: str) -> str:
    """
    Read the first http(s) URL out of a local .txt file.
    Returns '' if the file can't be read or has no URL line.
    """
    try:
        with open(abs_path, 'r', encoding='utf-8', errors='ignore') as fh:
            for line in fh:
                line = line.strip()
                if line.startswith(('http://', 'https://')):
                    return line
    except Exception as exc:
        print(f'  [WARN] Could not read {abs_path}: {exc}')
    return ''


# ── ④ SEMESTER DISCOVERY ────────────────────────────────────────────────────

# Only folders that look exactly like "<number>sem" (any case) count as
# semester repos — e.g. 3sem, 4sem, 7sem, 1sem, 8sem. Anything else inside
# LOCAL_BASE_DIR (other tools, notes, random folders, etc.) is skipped and
# never traversed.
SEMESTER_FOLDER_RE = re.compile(r'^(\d+)sem$', re.IGNORECASE)


def discover_semesters(base_dir: str) -> List[Dict[str, Any]]:
    """
    Look inside LOCAL_BASE_DIR and pick out only the subfolders matching
    the "<number>sem" pattern (3sem, 4sem, 7sem, ...) — every other folder
    is ignored entirely. Returns a list sorted by the semester number.
    """
    semesters: List[Dict[str, Any]] = []
    skipped:   List[str] = []

    for name in os.listdir(base_dir):
        full = os.path.join(base_dir, name)
        if not os.path.isdir(full):
            continue

        match = SEMESTER_FOLDER_RE.match(name)
        if not match:
            skipped.append(name)
            continue

        num = int(match.group(1))
        semesters.append({
            'folder':  name,
            'num':     num,
            'display': ordinal_semester_name(name),
        })

    if skipped:
        print(f'  (Skipping non-semester folders: {", ".join(skipped)})')

    semesters.sort(key=lambda s: (s['num'], s['folder'].lower()))
    return semesters


# ── ⑤ LOCAL DIRECTORY → RESOURCE STRUCTURE ─────────────────────────────────

def scan_local_dir(
    abs_dir_path: str,
    rel_path: str,
    owner: str,
    repo: str,
    branch: str,
) -> List[Dict]:
    """
    Recursively scan a local directory and build the nested resource JSON
    structure — same schema and same stem-pairing logic as before, just
    reading straight from disk instead of the GitHub API.

    rel_path is the path (forward-slash, relative to the semester's local
    root) baked into the raw GitHub URLs — it must match the path the same
    file has inside the corresponding GitHub repo.
    """
    try:
        entries = os.listdir(abs_dir_path)
    except (PermissionError, FileNotFoundError) as exc:
        print(f'  [WARN] Cannot read {abs_dir_path}: {exc}')
        return []

    dir_names:  List[str] = []
    file_names: List[str] = []
    for name in entries:
        full = os.path.join(abs_dir_path, name)
        if os.path.isdir(full):
            dir_names.append(name)
        elif os.path.isfile(full):
            file_names.append(name)

    items: List[Dict] = []

    # ── Pass 1: subdirectories, sorted alphabetically ──────────
    for dir_name in sorted(dir_names, key=str.lower):
        sub_abs = os.path.join(abs_dir_path, dir_name)
        sub_rel = join_rel(rel_path, dir_name)
        items.append({
            'name':     prettify_name(dir_name),
            'type':     'folder',
            'children': scan_local_dir(sub_abs, sub_rel, owner, repo, branch),
        })

    # ── Pass 2: group files by lower-cased stem ────────────────
    # stem_map: lowercase_stem → { ext_key: filename, '_display': original_stem }
    stem_map: Dict[str, Dict] = {}

    for fname in file_names:
        stem_raw, ext_raw = os.path.splitext(fname)
        stem_key = stem_raw.lower()
        ext_key  = ext_raw.lower()

        if stem_key not in stem_map:
            stem_map[stem_key] = {'_display': stem_raw}
        # First file with this (stem, ext) wins — same as v4/v5 behaviour
        if ext_key not in stem_map[stem_key]:
            stem_map[stem_key][ext_key] = fname

    # ── Pass 3: produce typed items ─────────────────────────────
    for stem_key in sorted(stem_map.keys()):
        exts         = stem_map[stem_key]
        display_stem = exts.get('_display', stem_key)

        # ── LINK: .txt + any image extension ──────────────────
        if '.txt' in exts:
            paired_img_ext = next((e for e in IMAGE_EXTS if e in exts), None)
            if paired_img_ext:
                txt_fname = exts['.txt']
                img_fname = exts[paired_img_ext]

                txt_abs  = os.path.join(abs_dir_path, txt_fname)
                link_url = read_link_from_txt(txt_abs)
                if not link_url:
                    print(f'  [WARN] No URL baked for link: {txt_abs}')

                item_obj: Dict[str, Any] = {
                    'name':      prettify_name(display_stem),
                    'type':      'link',
                    'thumbnail': make_raw_url(owner, repo, branch, join_rel(rel_path, img_fname)),
                    'txt':       make_raw_url(owner, repo, branch, join_rel(rel_path, txt_fname)),
                }
                if link_url:
                    item_obj['link'] = link_url
                items.append(item_obj)

            # .txt with no paired image → silently ignored (same as before)
            continue  # never process .txt or its image as standalone types

        # ── PDF ──────────────────────────────────────────────
        for ext in PDF_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'pdf',
                    'path': make_raw_url(owner, repo, branch, join_rel(rel_path, exts[ext])),
                })
                break

        # ── PPTX ─────────────────────────────────────────────
        for ext in PPTX_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'ppt',
                    'path': make_raw_url(owner, repo, branch, join_rel(rel_path, exts[ext])),
                })
                break

        # ── DOCX ─────────────────────────────────────────────
        for ext in DOCX_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'docx',
                    'path': make_raw_url(owner, repo, branch, join_rel(rel_path, exts[ext])),
                })
                break

        # ── Standalone image ───────────────────────────────────
        for ext in IMAGE_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'image',
                    'path': make_raw_url(owner, repo, branch, join_rel(rel_path, exts[ext])),
                })
                break

        # Anything else (zip, mp4, …) → silently ignored for now.
        # Add handling here when new file types are needed.

    return items


# ── ⑥ STATISTICS HELPERS (unchanged) ────────────────────────────────────────

def _flatten(items: List[Dict]):
    """Recursively yield every item in the tree."""
    for item in items:
        yield item
        if item.get('type') == 'folder':
            yield from _flatten(item.get('children', []))


def count_by_type(items: List[Dict]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for item in _flatten(items):
        t = item.get('type', 'unknown')
        counts[t] = counts.get(t, 0) + 1
    return counts


# ── ⑦ MAIN ──────────────────────────────────────────────────────────────────

def main() -> None:
    print('=' * 65)
    print('  Ministry of Mechanical Affairs — Resource Generator v6')
    print('  Local Scan Edition · No API, No Rate Limits')
    print('=' * 65)

    if not os.path.isdir(LOCAL_BASE_DIR):
        print(f'\n[ERROR] Base folder not found: {LOCAL_BASE_DIR}')
        print('        Edit LOCAL_BASE_DIR at the top of this script.')
        return

    semesters = discover_semesters(LOCAL_BASE_DIR)
    if not semesters:
        print(f'\n[ERROR] No semester subfolders found inside: {LOCAL_BASE_DIR}')
        return

    print(f'\nFound {len(semesters)} semester folder(s): '
          f'{", ".join(s["folder"] for s in semesters)}')

    all_data: List[Dict] = []

    for sem in semesters:
        folder   = sem['folder']
        sem_root = os.path.join(LOCAL_BASE_DIR, folder)
        print(f'\n── {sem["display"]}  ({folder}/) ─────────────')

        children = scan_local_dir(sem_root, '', GITHUB_OWNER, folder, GITHUB_BRANCH)

        all_data.append({
            'name':     sem['display'],
            'type':     'folder',
            'children': children,
        })
        print(f'  ✓ {len(children)} top-level items')

    # ── Write output ──────────────────────────────────────────────
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), OUTPUT_FILE)
    with open(output_path, 'w', encoding='utf-8') as fh:
        json.dump(all_data, fh, indent=2, ensure_ascii=False)

    # ── Stats ─────────────────────────────────────────────────────
    counts      = count_by_type(all_data)
    link_no_url = sum(
        1 for item in _flatten(all_data)
        if item.get('type') == 'link' and not item.get('link')
    )

    print(f'\n{"=" * 65}')
    print(f'✅  Generated: {output_path}')
    print(f'   Item counts: {counts}')

    if link_no_url:
        print(
            f'\n⚠  {link_no_url} link item(s) have no baked URL.'
            '\n   Check that each .txt file exists and contains a valid http(s) URL.'
        )
    else:
        print('   All link items have baked URLs ✓')

    print(
        '\nNext steps:'
        '\n  1. Push resources.json AND the actual files to their GitHub repos'
        '\n     (raw URLs baked above only resolve once files are on GitHub).'
        '\n  2. Hard-refresh the site ( Ctrl+Shift+R ) to clear the JSON cache.'
        '\n  3. No changes needed to index.html or script.js.'
    )
    print('=' * 65)


if __name__ == '__main__':
    main()

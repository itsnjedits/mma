#!/usr/bin/env python3
"""
============================================================
 generate_json.py — MMA Resource JSON Generator
 Ministry of Mechanical Affairs  (v5 — GitHub API Edition)
============================================================

USAGE:
    python generate_json.py

OUTPUT:
    resources.json   (in the same folder as this script)

HOW IT WORKS (v5 vs v4):
  v4 scanned a local   resources/  directory on disk.
  v5 fetches the same information from GitHub repositories
  via the GitHub REST API, then emits an IDENTICAL JSON schema.

  The frontend (script.js) and the JSON format are UNCHANGED.
  Only the path values differ: instead of relative local paths
  like  "resources/3rd sem/KOM/file.pdf",
  the paths are now absolute raw GitHub URLs:
  "https://raw.githubusercontent.com/owner/repo/main/KOM/file.pdf"

GITHUB API STRATEGY:
  For each semester repository, ONE call to the Git Trees API
  (GET /repos/{owner}/{repo}/git/trees/{sha}?recursive=1)
  retrieves the ENTIRE file tree.  This uses only 2 API calls
  per repo (branch + tree) regardless of folder depth.

  .txt file contents are fetched individually via the Blob API
  (one call per link item) to bake the URL into the JSON.

RATE LIMITS:
  - Unauthenticated: 60 requests / hour  (usually fine for small repos)
  - Authenticated:  5 000 requests / hour (recommended)
  Set GITHUB_TOKEN below.  No scopes needed for public repos.
  Create a token at: https://github.com/settings/tokens

ADDING NEW SEMESTERS:
  Add an entry to SEMESTER_REPOS.  Re-run the script.
  Push the updated resources.json to GitHub Pages.  Done.

JSON SCHEMA (same as v4 — frontend-compatible):
  Folders:  { name, type:"folder",  children:[...] }
  PDFs:     { name, type:"pdf",     path:"https://raw.github..." }
  PPTX:     { name, type:"ppt",     path:"https://raw.github..." }
  DOCX:     { name, type:"docx",    path:"https://raw.github..." }
  Images:   { name, type:"image",   path:"https://raw.github..." }
  Links:    { name, type:"link",    thumbnail:"https://...",
                                    txt:"https://...",
                                    link:"https://youtube..." }

LINK DETECTION (same logic as v4):
  <stem>.txt  +  <stem>.jpg   (same stem, any image ext)
    → type:"link"
       thumbnail = raw URL of the image
       txt       = raw URL of the .txt   (runtime fallback)
       link      = URL baked from .txt content at build time
  .txt with no paired image → silently ignored
============================================================
"""

import os
import json
import re
import base64
import time
import urllib.request
import urllib.parse
import urllib.error
from collections import defaultdict
from typing import Any, Dict, List, Optional


# ── ① CONFIGURATION — edit this block before running ──────────────────────

OUTPUT_FILE = 'resources.json'

# GitHub Personal Access Token (optional but strongly recommended).
# Raises the API rate limit from 60 → 5 000 requests/hour.
# Create one at https://github.com/settings/tokens
# No scopes are needed for public repositories.
GITHUB_TOKEN: str = ''

# Semester repositories.  Key = display name shown in the UI sidebar.
# Add / remove entries as semesters are created.
SEMESTER_REPOS: Dict[str, Dict[str, str]] = {
    '3rd Sem': {'owner': 'itsnjedits', 'repo': '3sem',  'branch': 'main'},
    '4th Sem': {'owner': 'itsnjedits', 'repo': '4sem',  'branch': 'main'},
    '5th Sem': {'owner': 'itsnjedits', 'repo': '5sem',  'branch': 'main'},
}

# ── ② FILE TYPE SETS ───────────────────────────────────────────────────────

IMAGE_EXTS: frozenset = frozenset({'.jpg', '.jpeg', '.png', '.webp', '.gif'})
PDF_EXTS:   frozenset = frozenset({'.pdf'})
PPTX_EXTS:  frozenset = frozenset({'.pptx'})
DOCX_EXTS:  frozenset = frozenset({'.docx'})

# ── ③ GITHUB API HELPERS ───────────────────────────────────────────────────

GITHUB_API = 'https://api.github.com'
RAW_BASE   = 'https://raw.githubusercontent.com'


def _make_request(url: str) -> urllib.request.Request:
    req = urllib.request.Request(url)
    req.add_header('Accept', 'application/vnd.github.v3+json')
    req.add_header('User-Agent', 'MMA-Resource-Generator/5.0')
    if GITHUB_TOKEN:
        req.add_header('Authorization', f'token {GITHUB_TOKEN}')
    return req


def github_get(url: str, retries: int = 4) -> Any:
    """
    Perform a GitHub API GET request with automatic retry and
    rate-limit back-off.  Returns parsed JSON.  Raises on final failure.
    """
    req = _make_request(url)
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                remaining = int(resp.headers.get('X-RateLimit-Remaining', 999))
                if remaining < 10:
                    reset_ts = int(resp.headers.get('X-RateLimit-Reset', 0))
                    wait = max(1, reset_ts - int(time.time())) + 2
                    print(f'  [RATE LIMIT] {remaining} requests left — sleeping {wait}s …')
                    time.sleep(wait)
                return json.loads(resp.read().decode('utf-8'))

        except urllib.error.HTTPError as exc:
            if exc.code == 403:
                # Hard rate-limit — wait until reset
                reset_ts = int(
                    exc.headers.get('X-RateLimit-Reset',
                                    int(time.time()) + 60)
                )
                wait = max(1, reset_ts - int(time.time())) + 2
                print(f'  [RATE LIMIT 403] Sleeping {wait}s (attempt {attempt + 1}/{retries}) …')
                time.sleep(wait)
            elif exc.code == 404:
                raise RuntimeError(f'404 Not Found: {url}') from exc
            else:
                wait = 2 ** attempt
                print(f'  [WARN] HTTP {exc.code} for {url} — retry in {wait}s …')
                time.sleep(wait)

        except Exception as exc:
            wait = 2 ** attempt
            print(f'  [WARN] {exc} — retry in {wait}s …')
            time.sleep(wait)

    raise RuntimeError(f'All {retries} attempts failed for: {url}')


def get_full_tree(owner: str, repo: str, branch: str) -> List[Dict]:
    """
    Fetch the entire repository file tree in ONE API call.

    Uses the Git Trees API with recursive=1.  This retrieves every file
    and directory path regardless of nesting depth, using only 2 API
    calls total (branch → tree SHA, then tree).

    Returns a flat list of dicts with keys: path, type (blob/tree), sha.
    """
    # Step 1: resolve the branch to a tree SHA
    branch_data = github_get(
        f'{GITHUB_API}/repos/{owner}/{repo}/branches/{urllib.parse.quote(branch, safe="")}'
    )
    tree_sha = branch_data['commit']['commit']['tree']['sha']

    # Step 2: fetch entire tree recursively
    tree_data = github_get(
        f'{GITHUB_API}/repos/{owner}/{repo}/git/trees/{tree_sha}?recursive=1'
    )

    if tree_data.get('truncated'):
        print(
            f'\n  ⚠  Tree truncated for {owner}/{repo}!'
            f'\n     GitHub caps recursive trees at ~100 000 entries.'
            f'\n     Some files may be missing from the output.'
            f'\n     Consider splitting very large repos into sub-repositories.\n'
        )

    return tree_data.get('tree', [])


def fetch_blob_text(owner: str, repo: str, sha: str, path_hint: str = '') -> str:
    """
    Fetch a blob's text content using its SHA (no path encoding needed).
    Returns the decoded text, or '' on any error.
    """
    if not sha:
        return ''
    url = f'{GITHUB_API}/repos/{owner}/{repo}/git/blobs/{sha}'
    try:
        data = github_get(url)
        # GitHub returns base64 with embedded newlines — strip them first
        content_b64 = data.get('content', '').replace('\n', '')
        return base64.b64decode(content_b64).decode('utf-8', errors='ignore')
    except Exception as exc:
        print(f'  [WARN] Could not fetch blob {sha[:8]} ({path_hint or "?"}): {exc}')
        return ''


def make_raw_url(owner: str, repo: str, branch: str, path: str) -> str:
    """
    Build a raw.githubusercontent.com URL with proper per-segment encoding.

    Example:
        owner='itsnjedits', repo='3sem', branch='main',
        path='KOM/Theory of Machines I.jpg'
        → 'https://raw.githubusercontent.com/itsnjedits/3sem/main/
           KOM/Theory%20of%20Machines%20I.jpg'
    """
    encoded_path = '/'.join(
        urllib.parse.quote(seg, safe='') for seg in path.split('/')
    )
    return f'{RAW_BASE}/{owner}/{repo}/{branch}/{encoded_path}'


# ── ④ NAME PRETTIFICATION (identical to v4) ────────────────────────────────

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


# ── ⑤ TREE → RESOURCE STRUCTURE ────────────────────────────────────────────

def build_resource_tree(
    flat_entries: List[Dict],
    owner: str,
    repo: str,
    branch: str,
) -> List[Dict]:
    """
    Convert a flat GitHub tree into the nested resource JSON structure.

    The output schema is byte-for-byte compatible with the v4 local
    scanner output — only path values change from relative local paths
    to absolute raw.githubusercontent.com URLs.

    Algorithm
    ---------
    1.  Group every entry by its parent directory path.
        Root-level items have parent = ''.
    2.  Build a SHA lookup for blobs (needed for .txt content fetching).
    3.  Recursively process each directory:
        a.  Subdirectories first (sorted alphabetically).
        b.  Files: group by lower-cased stem.
        c.  Stem groups → typed items (same pairing logic as v4):
              .txt + image  → link  (URL baked from blob content)
              .pdf          → pdf
              .pptx         → ppt
              .docx         → docx
              standalone image → image
              anything else → ignored
    """

    # ── Group entries by parent directory ────────────────────────
    # Root-level entries are keyed by '' (empty string).
    dir_children: Dict[str, List[Dict]] = defaultdict(list)
    sha_index:    Dict[str, str]        = {}   # full_path → blob SHA

    for entry in flat_entries:
        path   = entry.get('path', '')
        parent = path.rsplit('/', 1)[0] if '/' in path else ''
        dir_children[parent].append(entry)
        if entry['type'] == 'blob':
            sha_index[path] = entry.get('sha', '')

    # ── Recursive directory processor ────────────────────────────
    def process_dir(dir_path: str) -> List[Dict]:
        children = dir_children.get(dir_path, [])

        # Directories first, then files; both sorted alphabetically
        children.sort(key=lambda e: (e['type'] != 'tree', e['path'].lower()))

        items: List[Dict] = []

        # ── Pass 1: subdirectories ────────────────────────────
        for entry in children:
            if entry['type'] != 'tree':
                continue
            sub_path = entry['path']
            dir_name = sub_path.rsplit('/', 1)[-1] if '/' in sub_path else sub_path
            items.append({
                'name':     prettify_name(dir_name),
                'type':     'folder',
                'children': process_dir(sub_path),
            })

        # ── Pass 2: group files by lower-cased stem ───────────
        # stem_map: lowercase_stem → { ext_key: full_path, '_display': original_stem }
        stem_map: Dict[str, Dict] = {}

        for entry in children:
            if entry['type'] != 'blob':
                continue
            file_path = entry['path']
            fname     = file_path.rsplit('/', 1)[-1] if '/' in file_path else file_path
            stem_raw, ext_raw = os.path.splitext(fname)
            stem_key = stem_raw.lower()
            ext_key  = ext_raw.lower()

            if stem_key not in stem_map:
                stem_map[stem_key] = {'_display': stem_raw}
            # First file with this (stem, ext) wins — same as v4 behaviour
            if ext_key not in stem_map[stem_key]:
                stem_map[stem_key][ext_key] = file_path

        # ── Pass 3: produce typed items ───────────────────────
        for stem_key in sorted(stem_map.keys()):
            exts         = stem_map[stem_key]
            display_stem = exts.get('_display', stem_key)

            # ── LINK: .txt + any image extension ─────────────
            if '.txt' in exts:
                paired_img_ext = next(
                    (e for e in IMAGE_EXTS if e in exts), None
                )
                if paired_img_ext:
                    txt_path = exts['.txt']
                    img_path = exts[paired_img_ext]

                    # Bake URL from .txt blob content (1 API call per link item)
                    txt_sha  = sha_index.get(txt_path, '')
                    txt_text = fetch_blob_text(owner, repo, txt_sha, txt_path)
                    link_url = ''
                    if txt_text:
                        link_url = next(
                            (
                                line.strip()
                                for line in txt_text.splitlines()
                                if line.strip().startswith(('http://', 'https://'))
                            ),
                            ''
                        )
                    if not link_url:
                        print(f'  [WARN] No URL baked for link: {txt_path}')

                    item_obj: Dict[str, Any] = {
                        'name':      prettify_name(display_stem),
                        'type':      'link',
                        'thumbnail': make_raw_url(owner, repo, branch, img_path),
                        'txt':       make_raw_url(owner, repo, branch, txt_path),
                    }
                    if link_url:
                        item_obj['link'] = link_url
                    items.append(item_obj)

                # .txt with no paired image → silently ignored (same as v4)
                continue  # never process .txt or its image as standalone types

            # ── PDF ──────────────────────────────────────────
            for ext in PDF_EXTS:
                if ext in exts:
                    items.append({
                        'name': prettify_name(display_stem),
                        'type': 'pdf',
                        'path': make_raw_url(owner, repo, branch, exts[ext]),
                    })
                    break

            # ── PPTX ─────────────────────────────────────────
            for ext in PPTX_EXTS:
                if ext in exts:
                    items.append({
                        'name': prettify_name(display_stem),
                        'type': 'ppt',
                        'path': make_raw_url(owner, repo, branch, exts[ext]),
                    })
                    break

            # ── DOCX ─────────────────────────────────────────
            for ext in DOCX_EXTS:
                if ext in exts:
                    items.append({
                        'name': prettify_name(display_stem),
                        'type': 'docx',
                        'path': make_raw_url(owner, repo, branch, exts[ext]),
                    })
                    break

            # ── Standalone image ──────────────────────────────
            for ext in IMAGE_EXTS:
                if ext in exts:
                    items.append({
                        'name': prettify_name(display_stem),
                        'type': 'image',
                        'path': make_raw_url(owner, repo, branch, exts[ext]),
                    })
                    break

            # Anything else (zip, mp4, …) → silently ignored for now.
            # Add handling here when new file types are needed.

        return items

    return process_dir('')


# ── ⑥ STATISTICS HELPERS ───────────────────────────────────────────────────

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


# ── ⑦ MAIN ─────────────────────────────────────────────────────────────────

def main() -> None:
    print('=' * 65)
    print('  Ministry of Mechanical Affairs — Resource Generator v5')
    print('  GitHub API Edition · Efficient Git Tree Traversal')
    print('=' * 65)

    if not GITHUB_TOKEN:
        print(
            '\n⚠  GITHUB_TOKEN is not set.'
            '\n   Unauthenticated rate limit: 60 requests / hour.'
            '\n   For large repos or many semesters, you may hit this limit.'
            '\n   To raise it to 5 000 / hour:'
            '\n     1. Go to https://github.com/settings/tokens'
            '\n     2. Generate a "Classic" token (no scopes needed for public repos)'
            '\n     3. Paste it into GITHUB_TOKEN at the top of this script.'
        )

    all_data: List[Dict] = []

    for sem_name, cfg in SEMESTER_REPOS.items():
        owner  = cfg['owner']
        repo   = cfg['repo']
        branch = cfg['branch']
        print(f'\n── {sem_name}  ({owner}/{repo} @ {branch}) ─────────────')

        try:
            print('  Fetching full repository tree …')
            flat_tree = get_full_tree(owner, repo, branch)

            n_files = sum(1 for e in flat_tree if e['type'] == 'blob')
            n_dirs  = sum(1 for e in flat_tree if e['type'] == 'tree')
            print(f'  Tree:  {n_files} files,  {n_dirs} directories')

            print('  Building resource structure …')
            children = build_resource_tree(flat_tree, owner, repo, branch)

            all_data.append({
                'name':     sem_name,
                'type':     'folder',
                'children': children,
            })
            print(f'  ✓ {len(children)} top-level items')

        except Exception as exc:
            print(f'  [ERROR] {exc}')
            print(f'  ✗ Skipping {sem_name} — check repo name / access.')

    # ── Write output ──────────────────────────────────────────────
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), OUTPUT_FILE)
    with open(output_path, 'w', encoding='utf-8') as fh:
        json.dump(all_data, fh, indent=2, ensure_ascii=False)

    # ── Stats ─────────────────────────────────────────────────────
    counts       = count_by_type(all_data)
    link_no_url  = sum(
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
        '\n  1. Push resources.json to your GitHub Pages repo.'
        '\n  2. Hard-refresh the site ( Ctrl+Shift+R ) to clear the JSON cache.'
        '\n  3. No changes needed to index.html or script.js.'
    )
    print('=' * 65)


if __name__ == '__main__':
    main()

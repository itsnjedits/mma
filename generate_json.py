#!/usr/bin/env python3
"""
============================================================
 generate_json.py — MMA Resource JSON Generator
 Ministry of Mechanical Affairs  (v4 — URL-baking + docx)
============================================================

USAGE:
    python generate_json.py

OUTPUT:
    resources.json   (in same folder as this script)

RULES:
  - Folders         → type: "folder",  children: [...]
  - .pdf            → type: "pdf",     path: relative path
  - .pptx           → type: "ppt",     path: relative path
  - .docx           → type: "docx",    path: relative path
  - .jpg/.png (standalone, no paired .txt)
                    → type: "image",   path: relative path
  - <name>.txt  +  <name>.jpg   (SAME stem, any case)
                    → type: "link",
                         thumbnail: relative path to .jpg
                         link:      URL string read from .txt at build-time
                         txt:       relative path to .txt (kept for reference)
  - .txt without a paired image → IGNORED / skipped
  - Names are prettified: snake_case / CamelCase → Title Case

PATH RULES:
  - All paths in the JSON are relative to THIS SCRIPT'S directory.
  - Because index.html lives in the same directory as generate_json.py,
    relative paths like "resources/3rd sem/file.pdf" resolve correctly on
    GitHub Pages at https://itsnjedits.github.io/mma/resources/3rd sem/file.pdf

IMPORTANT — "mma/" prefix:
  - Do NOT manually prepend "mma/" to paths.
  - Paths are already correct relative to index.html.
  - Adding "mma/" would double the prefix on GitHub Pages (→ 404).

FOLDER STRUCTURE EXPECTED:
    (repo root / same folder as index.html)
    ├── generate_json.py
    ├── resources.json          ← OUTPUT written here
    ├── index.html
    └── resources/
        ├── 3rd sem/
        │   ├── KOM/
        │   │   ├── notes.pdf
        │   │   ├── lecture_video.txt   ← contains one URL line
        │   │   └── lecture_video.jpg   ← thumbnail
        │   └── ...
        └── 4th sem/
            └── ...
"""

import os
import json
import re

# ── Config ──────────────────────────────────────────────────
SCRIPT_DIR    = os.path.dirname(os.path.abspath(__file__))
RESOURCES_DIR = os.path.join(SCRIPT_DIR, 'resources')
OUTPUT_FILE   = os.path.join(SCRIPT_DIR, 'resources.json')

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
PDF_EXTS   = {'.pdf'}
PPTX_EXTS  = {'.pptx'}
DOCX_EXTS  = {'.docx'}


def prettify_name(raw_name: str) -> str:
    """Convert file/folder stem to readable title.

    fluid_mechanics_notes   → Fluid Mechanics Notes
    BernoulliTheorem        → Bernoulli Theorem
    """
    stem = os.path.splitext(raw_name)[0]
    stem = re.sub(r'[_\-]+', ' ', stem)
    stem = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', stem)
    return re.sub(r'\s+', ' ', stem).strip().title()


def relative_path(abs_path: str) -> str:
    """Return forward-slash path relative to SCRIPT_DIR (= the folder with index.html).

    For a file at:  /repo/resources/3rd sem/file.pdf
    Returns:        resources/3rd sem/file.pdf

    This path is correct relative to index.html on GitHub Pages:
      https://itsnjedits.github.io/mma/resources/3rd%20sem/file.pdf
    """
    rel = os.path.relpath(abs_path, SCRIPT_DIR)
    return rel.replace(os.sep, '/')


def read_url_from_txt(txt_path: str) -> str:
    """Read and return the URL stored inside a .txt link file.

    Returns an empty string if the file is missing, empty, or unreadable.
    The URL is baked into resources.json at build-time so the frontend
    never needs to make an extra network request.
    """
    try:
        with open(txt_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read().strip()
        if not content:
            print(f'  [WARN] .txt file is empty: {txt_path}')
            return ''
        # Take only the first non-blank line as the URL
        url = next((line.strip() for line in content.splitlines() if line.strip()), '')
        if not url.startswith(('http://', 'https://')):
            print(f'  [WARN] .txt does not contain a valid URL: {txt_path!r} → {url!r}')
            return ''
        return url
    except OSError as e:
        print(f'  [WARN] Could not read .txt file: {txt_path} — {e}')
        return ''


def scan_directory(directory: str) -> list:
    """
    Recursively scan *directory* and return a list of resource items.

    Processing order (per directory):
      1. Subdirectories  → folder items (recursed)
      2. Files grouped by lowercase stem:
           • stem has BOTH .txt AND an image ext → link item
             (URL is read from .txt now and stored as 'link')
           • stem has only .pdf                  → pdf item
           • stem has only .pptx                 → ppt item
           • stem has only .docx                 → docx item
           • stem has only image ext              → image item
           • anything else                        → ignored
    """
    items = []

    try:
        all_entries = sorted(
            os.scandir(directory),
            key=lambda e: (not e.is_dir(), e.name.lower())
        )
    except PermissionError:
        print(f'  [WARN] Permission denied: {directory}')
        return items

    # ── Pass 1: recurse into subdirectories ─────────────────
    for entry in all_entries:
        if entry.name.startswith('.') or entry.name.startswith('__'):
            continue
        if entry.is_dir():
            children = scan_directory(entry.path)
            items.append({
                'name':     prettify_name(entry.name),
                'type':     'folder',
                'children': children,
            })

    # ── Pass 2: group files by lowercase stem ────────────────
    # Build a dict:  lowercase_stem → { ext: abs_path, ... }
    stem_map: dict[str, dict[str, str]] = {}

    for entry in all_entries:
        if entry.name.startswith('.') or entry.name.startswith('__'):
            continue
        if not entry.is_file():
            continue

        stem_raw, ext_raw = os.path.splitext(entry.name)
        stem_key = stem_raw.lower()
        ext_key  = ext_raw.lower()

        if stem_key not in stem_map:
            stem_map[stem_key] = {}
        stem_map[stem_key][ext_key] = entry.path

        if '_display' not in stem_map[stem_key]:
            stem_map[stem_key]['_display'] = stem_raw  # original-case stem for display

    # ── Pass 3: produce item objects ─────────────────────────
    for stem_key, exts in stem_map.items():
        display_stem = exts.get('_display', stem_key)

        # ── LINK: .txt + any image extension ─────────────────
        # URL is read from the .txt at BUILD TIME and stored as 'link'.
        # The frontend uses item.link directly — no runtime fetch needed.
        if '.txt' in exts:
            paired_img_ext = next((e for e in IMAGE_EXTS if e in exts), None)
            if paired_img_ext:
                txt_abs = exts['.txt']
                url = read_url_from_txt(txt_abs)
                entry_obj = {
                    'name':      prettify_name(display_stem),
                    'type':      'link',
                    'thumbnail': relative_path(exts[paired_img_ext]),
                    'txt':       relative_path(txt_abs),   # kept for reference / fallback
                }
                if url:
                    entry_obj['link'] = url
                else:
                    print(f'  [WARN] No URL baked for link: {display_stem} (txt: {txt_abs})')
                items.append(entry_obj)
            else:
                # .txt with no paired image — silently ignored
                pass
            continue  # do not process .txt or paired image separately

        # ── PDF ──────────────────────────────────────────────
        for ext in PDF_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'pdf',
                    'path': relative_path(exts[ext]),
                })
                break

        # ── PPTX ─────────────────────────────────────────────
        for ext in PPTX_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'ppt',
                    'path': relative_path(exts[ext]),
                })
                break

        # ── DOCX ─────────────────────────────────────────────
        for ext in DOCX_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'docx',
                    'path': relative_path(exts[ext]),
                })
                break

        # ── STANDALONE IMAGE ─────────────────────────────────
        for ext in IMAGE_EXTS:
            if ext in exts:
                items.append({
                    'name': prettify_name(display_stem),
                    'type': 'image',
                    'path': relative_path(exts[ext]),
                })
                break

        # (Anything else is silently ignored)

    return items


def main():
    print('=' * 60)
    print('  Ministry of Mechanical Affairs — Resource Generator v4')
    print('  URL-baking edition — no runtime .txt fetches needed')
    print('=' * 60)

    if not os.path.isdir(RESOURCES_DIR):
        print(f'\n[ERROR] Resources directory not found: {RESOURCES_DIR}')
        print("  Create a 'resources/' folder alongside this script.")
        return

    print(f'\nScript dir  : {SCRIPT_DIR}')
    print(f'Resources at: {RESOURCES_DIR}')
    print(f'Output file : {OUTPUT_FILE}')
    print()
    print('Paths will be relative to script dir (= index.html location).')
    print('Example: resources/3rd sem/KOM/file.pdf')
    print('  ✓ Resolves correctly on GitHub Pages at /mma/resources/...')
    print()
    print('Scanning...\n')

    data = scan_directory(RESOURCES_DIR)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    # ── Stats ──────────────────────────────────────────────────
    def count_by_type(items):
        counts = {}
        for item in items:
            t = item.get('type', 'unknown')
            counts[t] = counts.get(t, 0) + 1
            if t == 'folder':
                sub = count_by_type(item.get('children', []))
                for k, v in sub.items():
                    counts[k] = counts.get(k, 0) + v
        return counts

    counts = count_by_type(data)
    link_items_no_url = sum(
        1 for item in _flatten(data)
        if item.get('type') == 'link' and not item.get('link')
    )

    print(f'\n✅  Generated: {OUTPUT_FILE}')
    print(f'   Item counts: {counts}')
    if link_items_no_url:
        print(f'\n⚠  {link_items_no_url} link item(s) have no baked URL.')
        print('   Check that their .txt files exist and contain a valid http(s) URL.')
    else:
        print('   All link items have baked URLs ✓')
    print('\nDone. Push to GitHub and enjoy the Ministry.')
    print('=' * 60)


def _flatten(items):
    """Recursively yield all items."""
    for item in items:
        yield item
        if item.get('type') == 'folder':
            yield from _flatten(item.get('children', []))


if __name__ == '__main__':
    main()

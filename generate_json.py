#!/usr/bin/env python3
"""
============================================================
 generate_json.py — MMA Resource JSON Generator
 Ministry of Mechanical Affairs  (v3 — filesystem-based links)
============================================================

USAGE:
    python generate_json.py

OUTPUT:
    resources.json

RULES:
  - Folders         → type: "folder",  children: [...]
  - .pdf            → type: "pdf",     path: relative path
  - .jpg/.png (standalone, no paired .txt)
                    → type: "image",   path: relative path
  - <name>.txt  +  <name>.jpg   (SAME stem, any case)
                    → type: "link",
                         thumbnail: relative path to .jpg
                         txt:       relative path to .txt
                         (URL is NOT read into JSON — frontend fetches it at runtime)
  - .txt without a paired image → IGNORED / skipped
  - Names are prettified: snake_case / CamelCase → Title Case

FOLDER STRUCTURE EXPECTED:
    mma/
    ├── resources/
    │   ├── Mechanics/
    │   │   ├── notes.pdf
    │   │   ├── lecture_video.txt     ← contains one URL line
    │   │   └── lecture_video.jpg     ← thumbnail for the link
    │   └── Thermodynamics/
    │       └── ...
    └── generate_json.py
"""

import os
import json
import re

# ── Config ──────────────────────────────────────────────────
RESOURCES_DIR = os.path.join(os.path.dirname(__file__), 'resources')
OUTPUT_FILE   = os.path.join(os.path.dirname(__file__), 'resources.json')

IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
PDF_EXTS   = {'.pdf'}


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
    """Return forward-slash path relative to the project root."""
    root = os.path.dirname(RESOURCES_DIR)
    rel  = os.path.relpath(abs_path, root)
    return rel.replace(os.sep, '/')


def scan_directory(directory: str) -> list:
    """
    Recursively scan *directory* and return a list of resource items.

    Processing order (per directory):
      1. Subdirectories  → folder items (recursed)
      2. Files grouped by lowercase stem:
           • stem has BOTH .txt AND an image ext → link item
             (stores relative paths for both thumbnail and txt;
              URL is NOT embedded in JSON — frontend fetches it at runtime)
           • stem has only .pdf                  → pdf item
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
        print(f"  [WARN] Permission denied: {directory}")
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
        # Store PATHS only. Frontend fetches the URL from the .txt at runtime.
        if '.txt' in exts:
            paired_img_ext = next((e for e in IMAGE_EXTS if e in exts), None)
            if paired_img_ext:
                items.append({
                    'name':      prettify_name(display_stem),
                    'type':      'link',
                    'thumbnail': relative_path(exts[paired_img_ext]),
                    'txt':       relative_path(exts['.txt']),
                    # NOTE: 'link' URL is intentionally NOT stored here.
                    # The frontend will fetch the .txt file at click-time.
                })
            # else: .txt without paired image → silently ignored
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
    print("=" * 60)
    print("  Ministry of Mechanical Affairs — Resource Generator v3")
    print("=" * 60)

    if not os.path.isdir(RESOURCES_DIR):
        print(f"\n[ERROR] Resources directory not found: {RESOURCES_DIR}")
        print("  Create a 'resources/' folder alongside this script.")
        return

    print(f"\nScanning: {RESOURCES_DIR}\n")
    data = scan_directory(RESOURCES_DIR)

    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n✅  Generated: {OUTPUT_FILE}")
    print(f"   Total top-level items: {len(data)}")
    print("\nDone. Upload the project to GitHub Pages and enjoy the Ministry.")
    print("=" * 60)


if __name__ == '__main__':
    main()

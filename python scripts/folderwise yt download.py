import os
import re
import json
import subprocess
from pathlib import Path

from PIL import Image

# ============================================================
# CONFIG
# ============================================================

YTDLP = r"Y:\WEB DEVELOPMENT\mma\python scripts\yt-dlp.exe"

FOLDER_PLAYLISTS = {
    r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\KOM": [
        "https://www.youtube.com/playlist?list=PLtPuDMgNkebNQPuvnAgJ0HINjSI9SDMqc",
        "https://www.youtube.com/playlist?list=PLhSp9OSVmeyJSYB4gKPL8UrmB_a3kfHYI",
        "https://www.youtube.com/playlist?list=PLhSp9OSVmeyKKS7M5Ze_FCoVy6aNoNsN8",
        "https://www.youtube.com/playlist?list=PLhSp9OSVmeyI2PBr_MjBGJbIrqSk65oV_",
        "https://www.youtube.com/playlist?list=PL9wPcNdXzjFiHpY1nZQ1P3FWiRw6KHM5p",
    ],

    r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\MT": [
        "https://www.youtube.com/playlist?list=PL727BYvm8B1ktF49TnajUYqZTvMd8R6bB",
    ],

    r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\MOS": [
        "https://www.youtube.com/playlist?list=PL727BYvm8B1n-DA6Ruv-fYFpTr41Dkvm2",
        "https://www.youtube.com/playlist?list=PLlAsaxNp1exM1XEgXKpx-U8NQ3KqGNGEA",
        "https://www.youtube.com/playlist?list=PL4K9r9dYCOorg2izEmfn_cLDmWqB-3oxV",
    ],

    r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\Maths": [
        "https://www.youtube.com/playlist?list=PLU6SqdYcYsfLrTna7UuaVfGZYkNo0cpVC",
    ],

    r"Y:\WEB DEVELOPMENT\mma\resources\4th sem\PMT": [
        "https://www.youtube.com/playlist?list=PLTj8Y3qIWmgGR-gEE9zwx91L3JbI412Mr",
    ],

    r"Y:\WEB DEVELOPMENT\mma\resources\4th sem\FM": [
        "https://www.youtube.com/playlist?list=PL727BYvm8B1mINwfNNRyd1iDWmImB_Xdz",
        "https://www.youtube.com/playlist?list=PL727BYvm8B1lxNR6uFpqNq81-_9IgnJNQ",
        "https://www.youtube.com/playlist?list=PLOKNrldi7ClhMMDSfsvL67nTzrT7q-38S",
    ],

    r"Y:\WEB DEVELOPMENT\mma\resources\4th sem\MD": [
        "https://www.youtube.com/playlist?list=PL4K9r9dYCOopj1vhL3ho8W39v1NPoQ-cQ",
        "https://www.youtube.com/playlist?list=PLCiOuVdcDqQVghdkDSi7UOLXyNLZSOM5x",
        "https://www.youtube.com/playlist?list=PLm_MSClsnwm-QwOu8EkbM7C-DOUB4DxLD",
    ],

    r"Y:\WEB DEVELOPMENT\mma\resources\4th sem\KDM": [
        "https://www.youtube.com/playlist?list=PL03n4PEXL4sZyEMmPgeMaTWSZ16fe1Rxy",
        "https://www.youtube.com/playlist?list=PLCiOuVdcDqQW8SrcSLL6rZzslryhOds-T",
    ],
}

# ============================================================
# HELPERS
# ============================================================

def sanitize_filename(name: str) -> str:
    name = re.sub(r'[<>:"/\\|?*]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    name = name.rstrip(".")
    return name


def get_playlist_info(url: str):

    cmd = [
        YTDLP,
        "--flat-playlist",
        "--dump-single-json",
        url
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr)

    return json.loads(result.stdout)


def download_thumbnail(url: str, output_base: str):

    cmd = [
        YTDLP,
        "--skip-download",
        "--write-thumbnail",
        "--convert-thumbnails",
        "jpg",
        "-o",
        output_base,
        url
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8"
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr)


def ensure_jpg(output_base: str):

    jpg_path = output_base + ".jpg"

    if os.path.exists(jpg_path):
        return jpg_path

    candidates = [
        output_base + ".webp",
        output_base + ".png",
        output_base + ".jpeg",
        output_base + ".jfif",
    ]

    for src in candidates:

        if os.path.exists(src):

            img = Image.open(src).convert("RGB")
            img.save(jpg_path, "JPEG", quality=95)

            try:
                os.remove(src)
            except:
                pass

            return jpg_path

    return None


# ============================================================
# PROCESS
# ============================================================

def process_playlist(folder, url):

    print("\nProcessing:")
    print(url)

    data = get_playlist_info(url)

    title = data.get("title", "Untitled Playlist")
    title = sanitize_filename(title)

    output_base = str(Path(folder) / title)

    print(f"Title: {title}")

    # --------------------------------------------------------
    # Thumbnail
    # --------------------------------------------------------

    download_thumbnail(url, output_base)

    jpg_path = ensure_jpg(output_base)

    if jpg_path:
        print(f"Thumbnail: {jpg_path}")
    else:
        print("WARNING: Thumbnail not found")

    # --------------------------------------------------------
    # TXT
    # --------------------------------------------------------

    txt_path = output_base + ".txt"

    with open(txt_path, "w", encoding="utf-8") as f:
        f.write(url)

    print(f"TXT: {txt_path}")


# ============================================================
# MAIN
# ============================================================

def main():

    if not os.path.exists(YTDLP):
        print(f"\nERROR: yt-dlp not found:")
        print(YTDLP)
        return

    total = 0

    for folder, urls in FOLDER_PLAYLISTS.items():

        Path(folder).mkdir(parents=True, exist_ok=True)

        print("\n" + "=" * 80)
        print(folder)
        print("=" * 80)

        for url in urls:

            try:
                process_playlist(folder, url)
                total += 1

            except Exception as e:

                print("\nERROR:")
                print(url)
                print(str(e))

    print("\n" + "=" * 80)
    print(f"Completed. Processed {total} playlists.")
    print("=" * 80)


if __name__ == "__main__":
    main()
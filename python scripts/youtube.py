import os
import re
import subprocess
import json

# 🔗 Your links
urls = [
    "https://youtu.be/gFhrCe2LMow",
    "https://youtu.be/VGahH86LjX8",
    "https://youtu.be/WFOf4WwBH60",
    "https://youtu.be/WQFbb5bHRy8",
    "https://youtu.be/YjOrDcjMduk",
    "https://youtu.be/cC_C-3T1u_8",
    "https://youtu.be/DSr4G3l8e78",
    "https://youtu.be/HqD7KtvEgB4",
    "https://youtu.be/pLt-MaxKW0o",
    "https://youtu.be/RPFrQ93OcKs",
    "https://youtu.be/w8-mAykM00I"
]

# 🔧 filename cleaner
def clean_filename(name):
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = name.strip()
    return name[:150]  # avoid too long names

for url in urls:
    try:
        print(f"\nProcessing: {url}")

        # 📥 Get metadata JSON safely
        result = subprocess.run(
            ["yt-dlp", "--dump-json", url],
            capture_output=True,
            text=True
        )

        data = json.loads(result.stdout)
        title = clean_filename(data["title"])

        print(f"Title: {title}")

        # 🖼️ Download thumbnail as jpg
        subprocess.run([
            "yt-dlp",
            "--skip-download",
            "--write-thumbnail",
            "--convert-thumbnails", "jpg",
            "-o", f"{title}.%(ext)s",
            url
        ])

        # 📝 Create txt file
        with open(f"{title}.txt", "w", encoding="utf-8") as f:
            f.write(url)

        print("✅ Done")

    except Exception as e:
        print(f"❌ Error: {e}")

print("\n🎉 All done bhai!")
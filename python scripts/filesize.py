import os
import subprocess

SIZE_LIMIT = 50 * 1024 * 1024  # 50 MB
GS_COMMAND = "gswin64c"


def size_mb(path):
    return os.path.getsize(path) / (1024 * 1024)


def compress_pdf(file_path):
    temp_output = file_path.replace(".pdf", "_temp.pdf")

    command = [
        GS_COMMAND,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        "-dPDFSETTINGS=/ebook",  # balanced quality
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        f"-sOutputFile={temp_output}",
        file_path
    ]

    result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    if result.returncode != 0:
        print("⚠️ Ghostscript error:")
        print(result.stderr.decode(errors="ignore"))
        return False

    if os.path.exists(temp_output):
        try:
            os.remove(file_path)
            os.rename(temp_output, file_path)
            return True
        except Exception as e:
            print(f"❌ Replace error: {e}")
            return False

    return False


def process_folder(folder):
    print("\n🔍 Scanning & Compressing PDFs...\n")

    found = False

    for root, dirs, files in os.walk(folder):
        for file in files:
            if not file.lower().endswith(".pdf"):
                continue

            file_path = os.path.join(root, file)

            try:
                size = os.path.getsize(file_path)

                if size >= SIZE_LIMIT:
                    found = True
                    before = size_mb(file_path)

                    print(f"\n📁 Processing: {file_path}")
                    print(f"📦 Before: {before:.2f} MB")

                    success = compress_pdf(file_path)

                    if success:
                        after = size_mb(file_path)
                        print(f"📉 After: {after:.2f} MB")
                    else:
                        print("⚠️ Compression failed")

                    print("-" * 60)

            except Exception as e:
                print(f"❌ Error: {file_path}")
                print(e)

    if not found:
        print("✅ No PDF files above 50MB found.")


# ---------------- RUN ----------------
folder = input("Enter folder path: ").strip()

if not os.path.exists(folder):
    print("❌ Invalid path")
    exit()

process_folder(folder)

print("\n🎯 Done!")
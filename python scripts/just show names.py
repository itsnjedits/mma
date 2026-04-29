import os
import shutil

# 🔥 Mapping (same as before)
mapping = {
    "726134781-Manufacturing-Technology-Vol-2-by-P-N-Rao.pdf": r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\books",
    "b c punmia.pdf": r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\books",
    "Thermo.pdf": r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\books",
    "properties of gases and gas mixtures.pdf": r"Y:\WEB DEVELOPMENT\mma\resources\3rd sem\Thermo",
    "4th_Edition_Design_Data_Handbook_for_Mechanical_Engineers_in_SI_and_Metric_Units_by_K_Mahadevan_K_Balaveera_Reddy.pdf": r"Y:\WEB DEVELOPMENT\mma\resources\4th sem\machine design",
    "mcm.pdf": r"Y:\WEB DEVELOPMENT\mma\resources\4th sem\MCM"
}


def restore_and_replace(compressed_folder):
    if not os.path.exists(compressed_folder):
        print("❌ Invalid compressed folder path!")
        return

    print("\n🚀 Replacing original files with compressed ones...\n")

    for file in os.listdir(compressed_folder):
        file_path = os.path.join(compressed_folder, file)

        if not os.path.isfile(file_path):
            continue

        if "_compressed" not in file:
            continue

        original_name = file.replace("_compressed", "")

        if original_name in mapping:
            dest_folder = mapping[original_name]
            dest_path = os.path.join(dest_folder, original_name)

            try:
                os.makedirs(dest_folder, exist_ok=True)

                # 🔥 STEP 1: delete existing file if exists
                if os.path.exists(dest_path):
                    os.remove(dest_path)
                    print(f"🗑️ Removed old: {dest_path}")

                # 🔥 STEP 2: move + rename
                shutil.move(file_path, dest_path)

                print(f"✅ Replaced with: {dest_path}\n")

            except Exception as e:
                print(f"⚠️ Error with {file}: {e}")

        else:
            print(f"❌ No mapping for: {file}")

    print("🎯 Done! Sab files replace ho gayi.")


# -------- MAIN --------
if __name__ == "__main__":
    folder = input("📦 Enter compressed folder path: ").strip()
    restore_and_replace(folder)
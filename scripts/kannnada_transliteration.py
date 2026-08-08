

import json
from aksharamukha import transliterate


INPUT_FILE = "rigveda.json"
KANNADA_FILE = "rigveda_kannada.json"
TELUGU_FILE = "rigveda_telugu.json"


def transliterate_json(data, target_script):
    output = {}

    for key, entry in data.items():
        new_entry = entry.copy()

        # Sanskrit text fields
        for field in ["samh_dev_acc", "pada_dev_acc", "text"]:
            value = entry.get(field)

            if value:
                new_entry[field] = transliterate.process(
                    "Devanagari",
                    target_script,
                    value,
                    nativize=False
                ).replace(".", "।")  # Replace Devanagari danda with Telugu danda

        output[key] = new_entry

    return output


with open(INPUT_FILE, "r", encoding="utf-8") as f:
    data = json.load(f)

# Devanagari → Kannada
kannada_data = transliterate_json(data, "Kannada")

with open(KANNADA_FILE, "w", encoding="utf-8") as f:
    json.dump(
        kannada_data,
        f,
        ensure_ascii=False,
        indent=2
    )


print("Created:")
print(KANNADA_FILE)
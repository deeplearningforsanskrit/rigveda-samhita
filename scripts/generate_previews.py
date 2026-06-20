import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "rigveda.json"

with open(DATA, encoding="utf-8") as f:
    data = json.load(f)

preview_root = ROOT / "preview" / "sukta"
preview_root.mkdir(parents=True, exist_ok=True)
for file in preview_root.glob("*"):
    file.unlink()

done_parts = {}

for key, item in data.items():

    rik = item.get("rik_num", "")
    text = item.get("text", "")

    if text == "":
        # we got khanda, and we will skip it for preview.
        continue

    parts = rik.split(".")
    if len(parts) != 3:
        continue

    mandala = parts[0]
    sukta = parts[1]

    # Skip if this combination has already been processed
    if (mandala, sukta) in done_parts:
        continue
    done_parts[(mandala, sukta)] = True

    filename = f"{mandala}-{sukta}.html"

    title = f"ऋग्वेद संहिता: मण्डल {mandala}, सुक्त -{sukta}"
    description = text[:150]

    html = f"""<!DOCTYPE html>
<html lang="sa">
<head>
<meta charset="utf-8">

<title>{title}</title>

<meta property="og:title" content="{title}">
<meta property="og:description" content="{description}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://deeplearningforsanskrit.github.io/rigveda-samhita/preview/sukta/{filename}">

<script>
const ua = navigator.userAgent.toLowerCase();

const isBot =
    ua.includes("facebookexternalhit") ||
    ua.includes("twitterbot") ||
    ua.includes("linkedinbot") ||
    ua.includes("whatsapp") ||
    ua.includes("telegrambot") ||
    ua.includes("slackbot");

if (!isBot) {{
    location.replace(
      "https://deeplearningforsanskrit.github.io/rigveda-samhita/#rik={rik}"
    );
}}
</script>

</head>
<body>
<h1>{title}</h1>
<p>{description}</p>
</body>
</html>
"""

    (preview_root / filename).write_text(
        html,
        encoding="utf-8"
    )

print("Generated previews")
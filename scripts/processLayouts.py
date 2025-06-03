import json
import glob

letters = set("abcdefghijklmnopqrstuvwxyz,.'")

res = {}
for file in glob.glob("layout_source/*"):
    with open(file) as f:
        data = json.load(f)

    layout = ["~"] * 30

    if not data["keys"]:
        continue

    for key in data["keys"]:
        if key["row"] > 2 or key["col"] > 9:
            continue

        if not key["char"] in letters:
            continue

        pos = key["row"] * 10 + key["col"]
        layout[pos] = key["char"]

    layout = "".join(layout)

    diff = letters - set(layout)
    if diff and not diff - set(",.'"):
        for missing in diff:
            layout = layout.replace("~", missing, 1)

    if not letters - set(layout):
        res[data["name"]] = layout

print(json.dumps(res, indent=4))
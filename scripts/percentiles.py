import json
from numpy import percentile

data = json.load(open("data.json"))

res = {}
for name in data["whorf"]:
    res[name] = []

    stat = [x[name] for x in data.values()]

    for i in range(100):
        res[name].append(percentile(stat, i + 1))

print(json.dumps(res, indent=4))
import os
import json
from collections import Counter
from more_itertools import windowed

OUT_DIR = 'corpora'
CORPUS = 'quotes/monkeyracer.txt'
LETTERS = "abcdefghijklmnopqrstuvwxyz,./;'"

SIZES = {
    'monograms':  (1, 0),
    'bigrams':    (2, 0),
    'skipgrams':  (2, 1),
    'trigrams':   (3, 0),
}

def unshift(text: str):
    shift = dict(zip(
        '!@#$%^&*()_+:{}:<>?\"', 
        '1234567890-=;[];,./\'',
    ))
    
    return [shift.get(x, x) for x in text.lower()]

with open(CORPUS, 'r') as f:
    text = unshift(f.read())

if not os.path.exists(OUT_DIR):
    os.mkdir(OUT_DIR)

res = {}
for alias, (size, skip) in SIZES.items():
    grams = Counter(
        ''.join(x[:size // 2] + x[-size // 2:])
        for x in windowed(text, size + skip)
        if all(y in LETTERS for y in x)
    ).most_common()

    res[alias] = dict(grams)

with open(f'{OUT_DIR}/out.json', 'w') as f:
    json.dump(res, f, indent=4)
import os
import string
import requests
from bs4 import BeautifulSoup

MONKEYTYPE_URL = 'https://monkeytype.com/quotes/english.json'
TYPERACER_URL = 'https://typeracerdata.com/texts?texts=full&sort=relative_average'
OUT_DIR = 'quotes'

def convert(text: str):
    translator = str.maketrans("", "", string.punctuation)
    return text.translate(translator).lower()

# monkeytype
data = requests.get(MONKEYTYPE_URL).json()
mt_quotes = [x['text'] for x in data['quotes']]

# typeracer
html = BeautifulSoup(requests.get(TYPERACER_URL).content, 'html.parser')

rows = html.find('table').find_all('tr')
tr_quotes = [x.contents[5].text for x in rows[1:]]

# monkeyracer
mr_quotes = {convert(x): x for x in mt_quotes + tr_quotes}.values()

QUOTES = {
    'monkeytype':  mt_quotes,
    'typeracer':   tr_quotes,
    'monkeyracer': mr_quotes,
}

if not os.path.exists(OUT_DIR):
    os.mkdir(OUT_DIR)

for alias, quotes in QUOTES.items():
    text = '\n\n'.join(quotes)

    with open(f'{OUT_DIR}/{alias}.txt', 'w') as f:
        f.write(text)
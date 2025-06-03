export class Key {
    constructor(c, pos) {
        this.c = c
        this.pos = pos
    }
}

export class Pos {
    constructor(p) {
        this.p = p
        
        this.x = p % 10
        this.y = Math.floor(p / 10)
        this.f = [0, 1, 2, 3, 3, 6, 6, 7, 8, 9][this.x]
        this.h = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1][this.f]
    }
}

export const metrics = {
    "monograms": {},
    "bigrams": {
        "sfb": same_finger,
        "lsb": lateral,
        "hsb": hscissor,
        "fsb": fscissor
    },
    "skipgrams": {
        "sfs": same_finger,
        "lss": lateral,
        "hss": hscissor,
        "fss": fscissor
    },
    "trigrams": {
        "alternate": alternate,
        "roll": roll,
        "redirect": redirect,
        "onehand": onehand,
        "inroll": inroll,
        "outroll": outroll,
    }
}

export const positive = new Set("roll onehand inroll".split(" "))

function direction(a, b) {
    if (a.pos.h != b.pos.h) {
        return -1
    } else if (a.pos.f - b.pos.f < 0) {
        return a.pos.h
    } else if (a.pos.f - b.pos.f > 0) {
        return 1 - a.pos.h
    } else {
        return -1
    }
}

function same_finger(a, b) {
    return (
        a.pos.f == b.pos.f &&
        a.pos.p != b.pos.p
    )
}

function lateral(a, b) {
    return (
        a.pos.h == b.pos.h &&
        Math.abs(a.pos.f - b.pos.f) == 1 &&
        Math.abs(a.pos.x - b.pos.x) == 2
    ) 
}

function hscissor(a, b) {
    return (
        a.pos.h == b.pos.h &&
        a.pos.f != b.pos.f &&
        Math.abs(a.pos.y - b.pos.y) == 1 &&
        [1, 2, 7, 8].includes([a, b].reduce((x, y) => x.pos.y > y.pos.y ? x : y).pos.f)
    )
}

function fscissor(a, b) {
    return (
        a.pos.h == b.pos.h &&
        a.pos.f != b.pos.f &&
        Math.abs(a.pos.y - b.pos.y) == 2 &&
        [1, 2, 7, 8].includes([a, b].reduce((x, y) => x.pos.y > y.pos.y ? x : y).pos.f)
    )
}

function alternate(a, b, c) {
    return (
        a.pos.h != b.pos.h && 
        b.pos.h != c.pos.h
    )
}

function roll(a, b, c) {
    return (
        a.pos.h != c.pos.h &&
        a.pos.f != b.pos.f &&
        b.pos.f != c.pos.f
    )
}

function inroll(a, b, c) {
    return (
        a.pos.h != c.pos.h && (
            direction(a, b) == 0 ||
            direction(b, c) == 0
        )
    )
}

function outroll(a, b, c) {
    return (
        a.pos.h != c.pos.h && (
            direction(a, b) == 1 ||
            direction(b, c) == 1
        )
    )
}

function redirect(a, b, c) {
    return (
        a.pos.h == b.pos.h &&
        b.pos.h == c.pos.h &&
        a.pos.f != b.pos.f &&
        b.pos.f != c.pos.f &&
        direction(a, b) != direction(b, c)
    )
}

function onehand(a, b, c) {
    return (
        a.pos.h == b.pos.h &&
        b.pos.h == c.pos.h &&
        a.pos.f != b.pos.f &&
        b.pos.f != c.pos.f &&
        direction(a, b) == direction(b, c)
    )
}
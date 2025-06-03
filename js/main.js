import {Key, Pos, metrics, positive} from "./metrics.js"

const letters = "qlcmk'fuoynrstwpheaijxzgvbd,."

const colorSeq = [
    "#FFC978",
    "#97B96E",
    "#329C7A",
    "#00787C",
    "#1E5164",
]

const charBrackets = [
    "aehinorst",
    "dlu",
    "cfgmwy",
    "bpv,.",
]

let monogramConstraints = []
let bigramConstraints = []
let percentiles
let layouts
let corpus

let history = []
let hindex = -1

let prevStats
let currConstraint
let currDrag
let lightMode = true

class Layout {
    constructor(name = null, author = null) {
        this._name = name
        this._author = author
        this.modified = false
        this.unplaced = new Set(letters)
        
        this.options = {}
        for (const char of letters) {
            this.options[char] = new Set()

            for (let i=0; i < 30; i++) {
                const pos = new Pos(i)

                if (monogramConstraints.every(x => x(new Key(char, pos)))) {
                    this.options[char].add(pos)
                }
            }
        }
    }

    get name() {
        return this._name ? (this._name + (this.modified ? " (Mod)" : "")) : "Untitled"
    }

    get author() {
        return this._author ?? "Unknown"
    }

    get keymap() {
        const keymap = {}
        for (const [k, v] of Object.entries(this.options)) {
            if (!this.unplaced.has(k) && v.size == 1) {
                keymap[k] = new Key(k, [...v][0])
            }
        }

        return keymap
    }

    get string() {
        const chars = Array(30).fill("~")
        for (const [char, key] of Object.entries(this.keymap)) {
            if (!char.startsWith("~")) {
                chars[key.pos.p] = char
            }
        }

        return (
            chars.slice(0, 10).join(" ") + "\n" + 
            chars.slice(10, 20).join(" ") + "\n" +
            chars.slice(20, 30).join(" ")
        )
    }

    clone() {
        const cloned = new Layout(this._name)
        cloned.unplaced = structuredClone(this.unplaced)
        cloned.options = structuredClone(this.options)

        return cloned
    }

    placeChars(chars) {
        for (const [i, char] of Object.entries(chars)) {
            this.placeKey(new Key(char, new Pos(parseInt(i))))
        }
    }

    swap(a, b) {
        [this.options[a], this.options[b]] = [this.options[b], this.options[a]]
        this.modified = true
    }

    getLowEntropies() {
        let min_size
        let characters = []

        // Find lowest entropy characters
        for (const char of this.unplaced) {
            const places = this.options[char]

            if (min_size) {
                if (places.size < min_size) {
                    min_size = places.size
                    characters = [char]
                } else if (places.size == min_size) {
                    characters.push(char)
                }
            } else {
                min_size = places.size
                characters = [char]
            }
        }

        return characters
    }

    findChoice(characters) {
        const letter = randChoice(characters)
        const places = [...this.options[letter]]

        if (places.length) {
            return new Key(letter, randChoice(places))
        } else {
            return new Key(letter, new Pos(-1))
        }
    } 

    placeKey(key) {   
        if (key.pos.p != -1) {
            for (const char of this.unplaced) {
                const places = this.options[char]

                for (const pos of places) {
                    if (bigramConstraints.some(x => !x(new Key(char, pos), key))) {
                        places.delete(pos)
                    } else if (key.pos.p == pos.p) {
                        places.delete(pos)
                    }
                }
            }
    
            this.options[key.c] = new Set([key.pos])
        }
        
        this.unplaced.delete(key.c)
    }
}

class Stat {
    constructor() {
        this.count = 0
        this.total = 0
        this.grams = {}
    }

    get freq() {
        return this.count / this.total * 100
    }

    get top() {
        return Object.entries(this.grams)
            .sort(([, a], [, b]) => b - a)
            .map(([a, b]) => [a, b / this.total * 100])
    }

    add(gram, count) {
        this.grams[gram] = (this.grams[gram] ?? 0) + count
        this.count += count
    }
}

function getStats(layout) {
    const keymap = layout.keymap
    const res = {}

    for (const [ngramName, stats] of Object.entries(metrics)) {
        for (const [statName, func] of Object.entries(stats)) {
            res[statName] = new Stat()

            for (const [gram, count] of Object.entries(corpus[ngramName])) {
                const pos = [...gram].map(x => keymap[x])
                
                if (pos.some(x => !x)) {
                    continue
                }
                
                if (func(...pos)) {
                    res[statName].add(gram, count)
                }
                
                res[statName].total += count
            }
        }
    }

    return res
}

function renderLayout(layout) {
    document.getElementById("layoutTitle").innerHTML = layout.name.toUpperCase()
    const keys = document.getElementsByClassName("pos")

    for (const key of keys) {
        key.innerHTML = " "
    }
    
    for (const [char, key] of Object.entries(layout.keymap)) {
        keys[key.pos.p].innerHTML = char.toUpperCase()
    }
}

function renderStats(stats) {
    const cards = document.getElementsByClassName("card")

    for (const card of cards) {
        const statName = card.getElementsByClassName("header")[0].innerHTML.toLowerCase()
        const stat = stats[statName]

        if (stat) {
            const freqDiv = card.getElementsByClassName("freq")[0]
            freqDiv.innerHTML = (stat.total ? stat.freq : 0).toFixed(3)
            
            if (percentiles[statName] && stat.total) {
                const rawcentile = percentiles[statName].findIndex(x => stat.freq <= x)

                const percentile = positive.has(statName) ? rawcentile + 1 : 100 - rawcentile
                card.getElementsByClassName("percentile")[0].innerHTML = percentile
                
                if (percentile > 50) {
                    freqDiv.classList.add("text-cyan-300")
                    freqDiv.classList.remove("text-orange-300")
                } else {
                    freqDiv.classList.add("text-orange-300")
                    freqDiv.classList.remove("text-cyan-300")
                }
            }

            if (prevStats && prevStats[statName].total && stat.total) {
                const change = stat.freq - prevStats[statName].freq
                const changeDiv = card.getElementsByClassName("change")[0]
                changeDiv.innerHTML = (change >= 0 ? "+" : "") + change.toFixed(3)
    
                if (positive.has(statName) ? change > 0 : change < 0) {
                    changeDiv.classList.add("text-cyan-300")
                    changeDiv.classList.remove("text-orange-300")
                } else if (positive.has(statName) ? change < 0 : change > 0) {
                    changeDiv.classList.add("text-orange-300")
                    changeDiv.classList.remove("text-cyan-300")
                } else {
                    changeDiv.classList.remove("text-orange-300", "text-cyan-300")
                }
            }

            const tops = stat.top
            const exampletemp = document.getElementById("exampletemp")
            const sampleCount = Math.min(tops.length, 4)
            
            const examples = card.getElementsByClassName("examples")[0]
            examples.innerHTML = ""

            for (let i=0; i < sampleCount; i++) {
                const example = exampletemp.cloneNode(true)

                const keys = example.firstElementChild
                keys.innerHTML = ""

                const keytemp = document.getElementById("keytemp")
                for (const char of tops[i][0]) {
                    const key = keytemp.cloneNode(true)

                    key.innerHTML = char
                    keys.appendChild(key)
                }

                example.getElementsByClassName("freq")[0].innerHTML = tops[i][1].toFixed(3)
                examples.appendChild(example)
            }
        }
    }
}

function colorKeys() {
    const keys = document.getElementsByClassName("key")

    for (const key of keys) {
        const char = key.innerHTML.toLowerCase()
        key.style.backgroundColor = colorSeq[4]
        for (const [j, chars] of charBrackets.entries()) {
            if (char != "" && chars.includes(char)) {
                key.style.backgroundColor = colorSeq[j]
                break
            }
        }

        if (key.innerHTML.startsWith("~")) {
            key.style.color = key.style.backgroundColor
        } else {
            key.style.color = ""
        }
    }
}

async function getPairs() {  
    const allowedPairs = {}  
    for (const char of letters) {
        allowedPairs[char] = new Set()
    }

    await fetch("pairs.json")
        .then(res => res.json())
        .then(function(pairData) {
            for (const pair of pairData) {
                allowedPairs[pair[0]].add(pair[1])
                allowedPairs[pair[1]].add(pair[0])
            }

            for (const char of letters) {
                if (allowedPairs[char].size == 0) {
                    allowedPairs[char] = new Set(letters)
                    allowedPairs[char].delete(char)
                }
            }
        })

    return allowedPairs
} 

function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)]
}

function getLayout(name) {
    const layout = new Layout(name)
    layout.placeChars(layouts[name])
    return layout
}

function makeLayout() {        
    const layout = new Layout(null, "Keysolve")
    
    while (layout.unplaced.size) {
        const key = layout.findChoice(layout.getLowEntropies())
        layout.placeKey(key)
    }

    return layout
}

function focusInput() {
    const input = document.getElementById("input")
    input.focus()

    const val = input.value
    input.value = ""
    input.value = val
}

function getChar() {
    const input = document.getElementById("input")
    const char = input.value.slice(-1)
    input.value = char != "" ? char : "*"
    return char
}

function setHeader(constraintNode, header) {
    const title = constraintNode.getElementsByClassName("title")[0]
    const placeholder = constraintNode.getElementsByClassName("placeholder")[0]

    
    if (header) {
        title.classList.remove("hidden")
        placeholder.classList.add("hidden")
    } else {
        title.classList.add("hidden")
        placeholder.classList.remove("hidden")
    }

    title.innerHTML = header
}

function addLetter(constraintNode, letter) {
    const currLetters = constraintNode.getElementsByClassName("letters")[0]
    const letterNode = document.getElementById("lettertemp").cloneNode()

    letterNode.id = ""
    letterNode.innerHTML = letter.toUpperCase()

    currLetters.insertBefore(letterNode, currLetters.lastElementChild)
}

function removeLetter(constraintNode) {
    const currLetters = constraintNode.getElementsByClassName("letters")[0]
    const penultimate = currLetters.lastElementChild.previousElementSibling
        
    if (penultimate) {
        penultimate.remove()
    }
}

function updateTitle() {
    const char = getChar()
    const title = currConstraint.getElementsByClassName("title")[0]

    if (char != "") {
        setHeader(currConstraint, title.innerHTML + char)
    } else {
        setHeader(currConstraint, title.innerHTML.slice(0, -1))
    }
}

function updateLetter() {
    const char = getChar()

    if (char != "") {
        addLetter(currConstraint, char)
    } else {
        removeLetter(currConstraint)
    }

    updateConstraints()
    colorKeys()
}

function showLayout() {
    const layout = history[hindex]
    renderLayout(layout)

    const stats = getStats(layout)
    renderStats(stats)
    prevStats = stats

    document.getElementById("keyMap").value = layout.string
    document.getElementById("layoutName").value = layout.name
    document.getElementById("layoutAuthor").value = layout.author

    if (hindex > 0) {
        document.getElementById("undoButton").removeAttribute("disabled")
    } else {
        document.getElementById("undoButton").setAttribute("disabled", true)
    }

    if (hindex + 1 < history.length) {
        document.getElementById("redoButton").removeAttribute("disabled")
    } else {
        document.getElementById("redoButton").setAttribute("disabled", true)
    }

    colorKeys()
}

function setLayout(layout) {
    history = history.slice(0, hindex + 1)
    history.push(layout)
    hindex++

    showLayout()
}

window.showRandom = function(maxTries = 1) {
    let best
    let score = 31
    
    for (let i=0; i < maxTries; i++) {
        const layout = makeLayout()
        const unplaced = [...letters].filter(x => layout.options[x].size != 1).length

        if (unplaced < score) {
            score = unplaced
            best = layout
        }

        if (score == 0) {
            break
        }
    }

    setLayout(best)
}

window.calcStats = function() {
    const res = {}
    for (const [name, chars] of Object.entries(layouts)) {
        res[name] = {}

        const layout = new Layout()
        for (let i=0; i < 30; i++) {
            layout.placeKey(new Key(chars[i], new Pos(i)))
        }
        
        const stats = getStats(layout)
        for (const [statName, stat] of Object.entries(stats)) {
            res[name][statName] = stat.freq
        }
    }

    return res
}

window.newConstraint = function(focus = true) {
    const constraintTemp = document.getElementById("constrainttemp")    
    const constraintNode = constraintTemp.cloneNode(true)   

    const keys = constraintNode.getElementsByClassName("positions")[0].children
    for (const [i, key] of Object.entries(keys)) {
        key.classList.add("square")
        key.addEventListener("mousedown", keyClicked)
    }

    constraintNode.getElementsByClassName("vistoggle")[0].addEventListener("click", function() {
        toggleVisibility(constraintNode)
    })
    
    constraintNode.removeAttribute("id")
    constraintNode.classList.add("constraint")
    document.getElementById("constraints").appendChild(constraintNode)

    document.getElementById("input").addEventListener("input", updateTitle)
    currConstraint = constraintNode

    if (focus) {
        focusInput()
    }

    document.getElementById("constraintHint").classList.add("hidden")
    return constraintNode
}

window.addConstraint = function(header, letters, places) {
    const constraintNode = newConstraint(false)
    setHeader(constraintNode, header)

    for (const char of letters) {
        addLetter(constraintNode, char)
    }

    const keys = constraintNode.getElementsByClassName("positions")[0].children
    for (const [i, key] of Object.entries(keys)) {
        if (places.includes(parseInt(i))) {
            key.classList.add("lit")
            key.style.backgroundColor = colorSeq[0]
        }
    }

    updateConstraints()
    colorKeys()
}

window.updateConstraints = function() {
    monogramConstraints = []

    for (const constraintNode of document.getElementsByClassName("constraint")) {
        const letters = []
        const positions = []
        
        for (const node of constraintNode.getElementsByClassName("letters")[0].children) {
            if (node.classList.contains("key")) {
                letters.push(node.innerHTML.toLowerCase())
            }
        }

        for (const [i, node] of Object.entries(constraintNode.getElementsByClassName("positions")[0].children)) {
            if (node.classList.contains("lit")) {
                positions.push(parseInt(i))
            }
        }

        const posSet = new Set(positions)
        const letSet = new Set(letters)
        monogramConstraints.push(function(a) {
            return !letSet.has(a.c) || posSet.has(a.pos.p)
        })
    }
}

window.addStat = function(name) {
    const stattemp = document.getElementById("stattemp")
    const statNode = stattemp.cloneNode(true)

    statNode.getElementsByClassName("header")[0].innerHTML = name.toUpperCase()

    statNode.removeAttribute("id")
    statNode.classList.add("card")
    document.getElementById("stats").appendChild(statNode)
}

window.keyClicked = function(ev) {    
    const key = ev.target
    lightMode = !key.classList.contains("lit")

    for (const square of key.parentElement.children) {
        square.addEventListener("mouseover", keyOver)
    }

    keyOver(ev)
}

window.keyOver = function(ev) {
    const key = ev.target

    if (lightMode) {
        key.classList.add("lit")
        key.style.backgroundColor = colorSeq[0]
    } else {
        key.classList.remove("lit")
        key.style.backgroundColor = ""
    }

    updateConstraints()
}

window.onmouseup = function() {
    for (const square of document.getElementsByClassName("square")) {
        square.removeEventListener("mouseover", keyOver)
    }
}

window.toggleAll = function() {
    const toggle = document.getElementById("toggleAll")

    if (toggle.getElementsByClassName("fa-angle-up")[0].classList.contains("hidden")) {
        for (const constraintNode of document.getElementsByClassName("content")) {
            constraintNode.classList.remove("hidden")
        }

        for (const arr of document.getElementsByClassName("fa-angle-up")) {
            arr.classList.remove("hidden")
        } 

        for (const arr of document.getElementsByClassName("fa-angle-down")) {
            arr.classList.add("hidden")
        } 
    } else {
        for (const constraintNode of document.getElementsByClassName("content")) {
            constraintNode.classList.add("hidden")
        }

        for (const arr of document.getElementsByClassName("fa-angle-up")) {
            arr.classList.add("hidden")
        } 

        for (const arr of document.getElementsByClassName("fa-angle-down")) {
            arr.classList.remove("hidden")
        } 
    }
}

window.toggleVisibility = function(node) {
    const content = node.getElementsByClassName("content")[0]
    const toggle = document.getElementById("toggleAll")

    if (content.classList.contains("hidden")) {
        content.classList.remove("hidden")
        node.getElementsByClassName("fa-angle-down")[0].classList.add("hidden")
        node.getElementsByClassName("fa-angle-up")[0].classList.remove("hidden")

        toggle.getElementsByClassName("fa-angle-down")[0].classList.add("hidden")
        toggle.getElementsByClassName("fa-angle-up")[0].classList.remove("hidden")
    } else {
        content.classList.add("hidden")
        node.getElementsByClassName("fa-angle-up")[0].classList.add("hidden")
        node.getElementsByClassName("fa-angle-down")[0].classList.remove("hidden")

        const arrows = document.getElementById("constraints").getElementsByClassName("fa-angle-up")
        if ([...arrows].every(x => x.classList.contains("hidden"))) {
            toggle.getElementsByClassName("fa-angle-down")[0].classList.remove("hidden")
            toggle.getElementsByClassName("fa-angle-up")[0].classList.add("hidden")
        }
    }
}

function showBar(barName) {
    const bar = document.getElementById("sidebar")
    const button = document.getElementById(`sidebar-button`)

    if (bar.classList.contains("hidden") || document.getElementById(`${barName}List`).classList.contains("hidden")) {
        for (const content of document.getElementById("barContent").children) {
            content.classList.add("hidden")
        }
    
        for (const header of document.getElementById("headers").children) {
            header.classList.add("hidden")
        }
    
        document.getElementById(`${barName}Header`).classList.remove("hidden")
        document.getElementById(`${barName}List`).classList.remove("hidden")
    
        if (bar.classList.contains("hidden")) {
            bar.classList.remove("hidden")
            button.classList.add("text-slate-500")
        }
    } else {
        bar.classList.add("hidden")
        button.classList.remove("text-slate-500")
    }
}

window.showSettingsBar = function() {
    showBar("settings")
}

window.showLayoutBar = function() {
    showBar("layout")

    const searchNode = document.getElementById("search")
    searchNode.value = ""
    searchNode.focus()

    getSearch()
}

window.showConstraintBar = function() {
    showBar("constraint")
}

window.toggleBar = function(name) {
    const bar = document.getElementById(name)
    const button = document.getElementById(`${name}-button`)

    if (bar.classList.contains("hidden")) {
        bar.classList.remove("hidden")
        button.classList.add("text-slate-500")
    } else {
        bar.classList.add("hidden")
        button.classList.remove("text-slate-500")
    }
}

window.focusLetters = function(ev) {
    document.getElementById("input").addEventListener("input", updateLetter)

    currConstraint = ev.target
    while (!currConstraint.classList.contains("constraint")) {
        currConstraint = currConstraint.parentElement
    }

    focusInput()
}

window.focusTitle = function(ev) {
    document.getElementById("input").addEventListener("input", updateTitle)

    currConstraint = ev.target
    while (!currConstraint.classList.contains("constraint")) {
        currConstraint = currConstraint.parentElement
    }

    focusInput()
}

window.focusOut = function() {
    document.getElementById("input").removeEventListener("input", updateTitle)
    document.getElementById("input").removeEventListener("input", updateLetter)
}

window.undo = function() {
    if (hindex > 0) {
        hindex--
        showLayout()
    }
}

window.redo = function() {
    if (hindex + 1 < history.length) {
        hindex++
        showLayout()
    }
}

window.copyLayout = function() {
    navigator.clipboard.writeText(document.getElementById("keyMap").value)
}

window.updateName = function() {
    const layout = history[hindex]
    layout._name = document.getElementById("layoutName").value
    renderLayout(layout)
}

window.updateAuthor = function() {
    const layout = history[hindex]
    layout._author = document.getElementById("layoutAuthor").value
    renderLayout(layout)
}

window.updateKeymap = function() {
    const keymap = document.getElementById("keyMap").value
    const chars = keymap.trim().split(/\s+/)

    if (chars.length == 30) {
        const layout = new Layout()
        layout.placeChars(chars)
        setLayout(layout)
    }
}

window.getSearch = function() {
    const searchTerm = document.getElementById("search").value.replace(/ /g, "-").toLowerCase()
    
    for (const layoutNode of document.getElementById("layoutList").children) {
        const layoutTitle = layoutNode.getElementsByClassName("layoutTitle")[0].innerHTML

        if (layoutTitle.toLowerCase().includes(searchTerm)) {
            layoutNode.classList.remove("hidden")
        } else {
            layoutNode.classList.add("hidden")
        }
    }
}

window.submitSearch = function(ev) {
    ev.preventDefault()

    const searchTerm = document.getElementById("search").value.replace(/ /g, "-").toLowerCase()

    const matches = []
    for (const layoutNode of document.getElementById("layoutList").children) {
        const layoutTitle = layoutNode.getElementsByClassName("layoutTitle")[0].innerHTML

        if (layoutTitle.toLowerCase().includes(searchTerm)) {
            matches.push(layoutTitle)
        }
    }

    const exact = matches.filter(x => x.toLowerCase() == searchTerm)
    const layoutName = exact.length ? exact[0] : matches[0]

    if (layoutName) {
        setLayout(getLayout(layoutName))
    }

    document.getElementById("search").value = ""
    getSearch()
}

window.onload = async function() {
    document.getElementById("input").value = "*"

    layouts = (await (await fetch("layouts.json")).json())

    const layoutNames = [...Object.keys(layouts)].sort((a, b) => (a.toLowerCase() > b.toLowerCase()))
    for (const name of layoutNames) {
        const layoutNode = document.getElementById("layoutTemp").cloneNode(true)
        
        layoutNode.removeAttribute("id")
        layoutNode.getElementsByClassName("layoutTitle")[0].innerHTML = name

        layoutNode.addEventListener("click", function() {
            setLayout(getLayout(name))
        })

        document.getElementById("layoutList").appendChild(layoutNode)
    }

    for (const key of document.getElementsByClassName("pos")) {
        key.setAttribute("draggable", true)
        key.addEventListener("dragstart", function() {
            currDrag = key
        })

        key.addEventListener("dragover", function(ev) {
            ev.preventDefault()
        })

        key.addEventListener("drop", function(ev) {
            ev.preventDefault()

            const a = ev.target.innerHTML.toLowerCase()
            const b = currDrag.innerHTML.toLowerCase()

            if (a != b) {
                const newLayout = history[hindex].clone()

                if ([a, b].includes(" ")) {
                    let child = a == " " ? ev.target : currDrag

                    let emptyIdx = 0
                    while ((child = child.previousElementSibling) != null) {
                        emptyIdx++
                    }
    
                    newLayout.placeKey(new Key("~", new Pos(emptyIdx)))
                    newLayout.swap(
                        a == " " ? "~" : a,
                        b == " " ? "~" : b,
                    )

                    delete newLayout.options["~"]
                } else {
                    newLayout.swap(a, b)
                }

                setLayout(newLayout)
            }
        })
    }
    
    const allowedPairs = await getPairs()
    percentiles = await (await fetch("percentiles.json")).json()
    corpus = await (await fetch("corpora/monkeyracer.json")).json()

    bigramConstraints = [
        function(a, b) {
            return (
                allowedPairs[a.c].has(b.c) ||
                a.pos.f != b.pos.f
            )
        },
        function(a, b) {
            return (
                allowedPairs[a.c].has(b.c) || !metrics["bigrams"]["fsb"](a, b)
            )
        }
    ]

    addConstraint("Homerow", "srnthaei", [10, 11, 12, 13, 16, 17, 18, 19])
    addConstraint("Vowels", "aeiou", [7, 8, 17, 18, 19,])

    for (const statGroup of Object.values(metrics)) {
        for (const stat of Object.keys(statGroup)) {
            addStat(stat)
        }
    }

    updateConstraints()
    toggleAll()
    // showLayoutBar()
    showSettingsBar()

    // showRandom()
    setLayout(getLayout("pine-v4"))
}
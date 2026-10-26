"use strict";

// Segment order: a, b, c, d, e, f, g
// 1 = segment ON, 0 = segment OFF
const SEGMENTS = ["a", "b", "c", "d", "e", "f", "g"];

const PATTERNS = {
    "0": [1, 1, 1, 1, 1, 1, 0],
    "1": [0, 1, 1, 0, 0, 0, 0],
    "2": [1, 1, 0, 1, 1, 0, 1],
    "3": [1, 1, 1, 1, 0, 0, 1],
    "4": [0, 1, 1, 0, 0, 1, 1],
    "5": [1, 0, 1, 1, 0, 1, 1],
    "6": [1, 0, 1, 1, 1, 1, 1],
    "7": [1, 1, 1, 0, 0, 0, 0],
    "8": [1, 1, 1, 1, 1, 1, 1],
    "9": [1, 1, 1, 1, 0, 1, 1],

    // Approximate seven-segment hexadecimal glyphs
    A: [1, 1, 1, 0, 1, 1, 1],
    B: [0, 0, 1, 1, 1, 1, 1],
    C: [1, 0, 0, 1, 1, 1, 0],
    D: [0, 1, 1, 1, 1, 0, 1],
    E: [1, 0, 0, 1, 1, 1, 1],
    F: [1, 0, 0, 0, 1, 1, 1]
};

const input = document.getElementById("userInput");
const inputMode = document.getElementById("inputMode");
const displayMode = document.getElementById("displayMode");
const display = document.getElementById("display");
const status = document.getElementById("status");
const decodedOutput = document.getElementById("decodedOutput");
const digitCount = document.getElementById("digitCount");
const manualDisplay = document.getElementById("manualDisplay");
const segmentControls = document.getElementById("segmentControls");
const truthTable = document.getElementById("truthTable");
const autoBtn = document.getElementById("autoBtn");

let autoTimer = null;
let manualPattern = null;
let lastDecoded = [];
let currentPosition = 0;

function logicFor(on) {
    // Common Cathode: HIGH turns a segment ON.
    // Common Anode: LOW turns a segment ON.
    if (displayMode.value === "cc") {
        return on ? "HIGH" : "LOW";
    }
    return on ? "LOW" : "HIGH";
}

function createDigit(character, pattern, extraClass = "") {
    const digit = document.createElement("div");
    digit.className = "digit " + extraClass;
    digit.setAttribute("aria-label", "Digit " + character);

    SEGMENTS.forEach((name, index) => {
        const segment = document.createElement("div");
        const on = Boolean(pattern[index]);

        segment.className = "segment " + name;
        segment.classList.toggle("on", on);
        segment.title = `Segment ${name.toUpperCase()}: ${on ? "ON" : "OFF"}, Logic ${logicFor(on)}`;

        digit.appendChild(segment);
    });

    return digit;
}

function decodeInput() {
    const raw = input.value.trim().toUpperCase();
    const mode = inputMode.value;

    if (!raw) {
        return { digits: [], error: null, output: "" };
    }

    if (mode === "decimal") {
        if (!/^[0-9]+$/.test(raw)) {
            return {
                digits: [],
                error: "Decimal mode accepts digits from 0 to 9 only.",
                output: ""
            };
        }

        return {
            digits: [...raw].map(char => ({
                symbol: char,
                pattern: PATTERNS[char]
            })),
            error: null,
            output: raw
        };
    }

    if (mode === "hex") {
        if (!/^[0-9A-F]+$/.test(raw)) {
            return {
                digits: [],
                error: "Hex mode accepts 0–9 and A–F only.",
                output: ""
            };
        }

        return {
            digits: [...raw].map(char => ({
                symbol: char,
                pattern: PATTERNS[char]
            })),
            error: null,
            output: raw
        };
    }

    // Binary input: accept groups of exactly four bits.
    const bits = raw.replace(/\s+/g, "");

    if (!/^[01]+$/.test(bits)) {
        return {
            digits: [],
            error: "Binary mode accepts only 0 and 1.",
            output: ""
        };
    }

    if (bits.length % 4 !== 0) {
        return {
            digits: [],
            error: "Enter binary in groups of 4 bits, e.g. 0101 or 00010010.",
            output: ""
        };
    }

    const digits = [];

    for (let i = 0; i < bits.length; i += 4) {
        const group = bits.slice(i, i + 4);
        const decimal = parseInt(group, 2);

        if (decimal > 9) {
            return {
                digits: [],
                error: `Binary group ${group} equals ${decimal}. BCD accepts 0000–1001 only.`,
                output: ""
            };
        }

        const symbol = String(decimal);

        digits.push({
            symbol,
            pattern: PATTERNS[symbol]
        });
    }

    return {
        digits,
        error: null,
        output: digits.map(item => item.symbol).join("")
    };
}

function renderDisplay() {
    const result = decodeInput();

    display.replaceChildren();
    manualPattern = null;
    updateSegmentControls(null);

    if (result.error) {
        lastDecoded = [];
        decodedOutput.textContent = "Invalid input";
        digitCount.textContent = "0";
        status.textContent = result.error;
        status.style.color = "#ff8794";
        return;
    }

    status.style.color = "";

    if (result.digits.length === 0) {
        lastDecoded = [];
        decodedOutput.textContent = "—";
        digitCount.textContent = "0";
        status.textContent = "Ready. Enter an input to see the output.";
        display.innerHTML = '<p class="empty-display">Enter input to begin</p>';
        updateManualDisplay(null);
        return;
    }

    lastDecoded = result.digits;

    result.digits.forEach(item => {
        display.appendChild(createDigit(item.symbol, item.pattern));
    });

    decodedOutput.textContent = result.output;
    digitCount.textContent = String(result.digits.length);

    const activeCount = result.digits.reduce((total, item) => {
        return total + item.pattern.reduce((sum, value) => sum + value, 0);
    }, 0);

    status.textContent =
        `Decoded successfully: ${result.output}. ` +
        `${activeCount} LED segments are ON across ${result.digits.length} digit(s).`;

    currentPosition = Math.min(currentPosition, result.digits.length - 1);
    updateManualDisplay(result.digits[currentPosition]?.pattern ?? null);
    renderTruthTable();
}

function updateManualDisplay(pattern) {
    manualDisplay.replaceChildren();

    if (!pattern) {
        pattern = [0, 0, 0, 0, 0, 0, 0];
    }

    SEGMENTS.forEach((name, index) => {
        const segment = document.createElement("div");
        const on = Boolean(pattern[index]);

        segment.className = "segment " + name;
        segment.classList.toggle("on", on);
        segment.title = `Segment ${name.toUpperCase()}: ${on ? "ON" : "OFF"} / Logic ${logicFor(on)}`;

        manualDisplay.appendChild(segment);
    });

    updateSegmentControls(pattern);
}

function updateSegmentControls(pattern) {
    segmentControls.replaceChildren();

    SEGMENTS.forEach((name, index) => {
        const label = document.createElement("label");
        label.className = "segment-control";
        label.htmlFor = "segment-" + name;

        const text = document.createElement("span");
        text.textContent = `Segment ${name.toUpperCase()}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = "segment-" + name;
        checkbox.checked = Boolean(pattern?.[index]);
        checkbox.setAttribute("aria-label", `Toggle segment ${name.toUpperCase()}`);

        checkbox.addEventListener("change", () => {
            if (!manualPattern) {
                manualPattern = [...(pattern ?? [0, 0, 0, 0, 0, 0, 0])];
            }

            manualPattern[index] = checkbox.checked ? 1 : 0;
            updateManualDisplay(manualPattern);
        });

        label.append(text, checkbox);
        segmentControls.appendChild(label);
    });
}

function renderTruthTable() {
    truthTable.replaceChildren();

    // The table represents standard decimal digit patterns.
    for (let digit = 0; digit <= 9; digit++) {
        const pattern = PATTERNS[String(digit)];
        const row = document.createElement("tr");

        const heading = document.createElement("td");
        heading.textContent = digit;
        row.appendChild(heading);

        pattern.forEach(on => {
            const cell = document.createElement("td");
            cell.textContent = logicFor(Boolean(on));
            cell.className = on ? "state-on" : "state-off";
            row.appendChild(cell);
        });

        truthTable.appendChild(row);
    }
}

function stopAutoCount() {
    if (autoTimer !== null) {
        clearInterval(autoTimer);
        autoTimer = null;
    }

    autoBtn.textContent = "▶ Auto Count";
}

function setInputModeHint() {
    const hints = {
        decimal: "Type a decimal number, e.g. 12345.",
        binary: "Enter 4-bit BCD groups, e.g. 0001 0010 0011 for 123.",
        hex: "Enter hexadecimal symbols 0–9 and A–F."
    };

    document.getElementById("inputHint").textContent = hints[inputMode.value];

    const placeholders = {
        decimal: "e.g. 12345",
        binary: "e.g. 0001 0010",
        hex: "e.g. 1A3F"
    };

    input.placeholder = placeholders[inputMode.value];
    renderDisplay();
}

input.addEventListener("input", () => {
    stopAutoCount();
    renderDisplay();
});

inputMode.addEventListener("change", () => {
    stopAutoCount();
    setInputModeHint();
});

displayMode.addEventListener("change", () => {
    renderDisplay();
});

document.querySelectorAll(".preset").forEach(button => {
    button.addEventListener("click", () => {
        stopAutoCount();
        inputMode.value = "decimal";
        setInputModeHint();
        input.value = button.dataset.value;
        renderDisplay();
    });
});

document.getElementById("demoBtn").addEventListener("click", () => {
    stopAutoCount();
    inputMode.value = "decimal";
    setInputModeHint();
    input.value = "12345";
    renderDisplay();
});

document.getElementById("clearBtn").addEventListener("click", () => {
    stopAutoCount();
    input.value = "";
    renderDisplay();
    input.focus();
});

document.getElementById("resetBtn").addEventListener("click", () => {
    stopAutoCount();
    inputMode.value = "decimal";
    input.value = "0";
    setInputModeHint();
    renderDisplay();
});

document.getElementById("applyPatternBtn").addEventListener("click", () => {
    const result = decodeInput();

    if (result.error || result.digits.length === 0) {
        status.textContent = result.error || "Enter a valid input first.";
        return;
    }

    currentPosition = Math.min(currentPosition, result.digits.length - 1);
    manualPattern = null;
    updateManualDisplay(result.digits[currentPosition].pattern);
    status.textContent =
        `Restored decoded pattern for digit ${result.digits[currentPosition].symbol}.`;
});

document.getElementById("allOffBtn").addEventListener("click", () => {
    manualPattern = [0, 0, 0, 0, 0, 0, 0];
    updateManualDisplay(manualPattern);
    status.textContent = "Manual test display: all segments OFF.";
});

autoBtn.addEventListener("click", () => {
    if (autoTimer !== null) {
        stopAutoCount();
        status.textContent = "Automatic counting stopped.";
        return;
    }

    inputMode.value = "decimal";
    setInputModeHint();
    input.value = "0";
    renderDisplay();

    autoBtn.textContent = "Ⅱ Stop Counting";

    autoTimer = setInterval(() => {
        const current = Number(input.value || "0");
        const next = (current + 1) % 10000;
        input.value = String(next);
        renderDisplay();
    }, 1000);
});

// Initialize the simulator
setInputModeHint();
renderTruthTable();
renderDisplay();
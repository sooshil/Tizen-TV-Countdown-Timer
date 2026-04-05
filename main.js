let totalSeconds = 0;
let timerInterval = null;
let timerRafId = null;
let isPaused = false;
let alarmSound;
let alarmTriggered = false;
let isTimerRunning = false;
let alarmPlaybackToken = 0;
const ENABLE_ALARM_AUDIO = true;
let countdownStartEpochMs = 0;
let timerStartSeconds = 0;
let pausedAtEpochMs = 0;
let totalPausedMs = 0;
let lastDisplayedText = "";
let setupScreenDetached = false;

const setupScreen = document.getElementById("setup-screen");
const timerScreen = document.getElementById("timer-screen");
const timerDisplay = document.getElementById("timer-display");
const customPanel = document.getElementById("custom-panel");
const customBtn = document.getElementById("custom-btn");
const presetsGrid = document.querySelector(".presets-grid");
const presetButtons = Array.from(document.querySelectorAll(".preset"));

let focusables = [];
let currentFocusIndex = 0;

function isVisible(el) {
    return !!(el && el.offsetParent !== null);
}

function refreshFocusables() {
    focusables = Array.from(document.querySelectorAll("#setup-screen .focusable")).filter(isVisible);

    if (!focusables.length) return;

    const active = document.activeElement;
    const activeIndex = focusables.indexOf(active);

    if (activeIndex >= 0) {
        currentFocusIndex = activeIndex;
    } else if (currentFocusIndex >= focusables.length) {
        currentFocusIndex = focusables.length - 1;
    }
}

function setFocus(index) {
    refreshFocusables();
    if (!focusables.length) return;

    if (index < 0) index = 0;
    if (index >= focusables.length) index = focusables.length - 1;

    currentFocusIndex = index;
    focusables[currentFocusIndex].focus();
}

function setFocusByElement(el) {
    refreshFocusables();
    const idx = focusables.indexOf(el);
    if (idx >= 0) {
        currentFocusIndex = idx;
        focusables[idx].focus();
    }
}

function findNearestByDirection(currentEl, direction) {
    const currRect = currentEl.getBoundingClientRect();
    const currX = currRect.left + currRect.width / 2;
    const currY = currRect.top + currRect.height / 2;

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const candidate of focusables) {
        if (candidate === currentEl) continue;

        const rect = candidate.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;

        const dx = x - currX;
        const dy = y - currY;

        if (direction === "left" && dx >= -4) continue;
        if (direction === "right" && dx <= 4) continue;
        if (direction === "up" && dy >= -4) continue;
        if (direction === "down" && dy <= 4) continue;

        let score;
        if (direction === "left" || direction === "right") {
            score = Math.abs(dx) + Math.abs(dy) * 2;
        } else {
            score = Math.abs(dy) + Math.abs(dx) * 2;
        }

        if (score < bestScore) {
            bestScore = score;
            best = candidate;
        }
    }

    return best;
}

function moveFocus(direction) {
    refreshFocusables();
    if (!focusables.length) return;

    let currentEl = document.activeElement;
    if (!focusables.includes(currentEl)) {
        currentEl = focusables[currentFocusIndex] || focusables[0];
    }

    const nearest = findNearestByDirection(currentEl, direction);
    if (nearest) {
        setFocusByElement(nearest);
        return;
    }

    const step = direction === "left" || direction === "up" ? -1 : 1;
    const idx = focusables.indexOf(currentEl);
    setFocus(idx + step);
}

function getPresetColumns() {
    if (!presetsGrid) return 1;
    const gridTemplate = window.getComputedStyle(presetsGrid).gridTemplateColumns;
    if (!gridTemplate || gridTemplate === "none") return 1;
    const cols = gridTemplate.split(" ").length;
    return cols > 0 ? cols : 1;
}

function movePresetFocus(currentPreset, direction) {
    const presetIndex = presetButtons.indexOf(currentPreset);
    if (presetIndex < 0) return false;

    const cols = getPresetColumns();
    const row = Math.floor(presetIndex / cols);
    const col = presetIndex % cols;
    const lastIndex = presetButtons.length - 1;
    const lastRow = Math.floor(lastIndex / cols);

    let nextIndex = presetIndex;

    if (direction === "left") {
        if (col === 0) return true;
        nextIndex = presetIndex - 1;
    } else if (direction === "right") {
        if (presetIndex >= lastIndex || col === cols - 1) return true;
        nextIndex = presetIndex + 1;
    } else if (direction === "up") {
        if (row === 0) return true;
        nextIndex = presetIndex - cols;
    } else if (direction === "down") {
        if (row >= lastRow) {
            setFocusByElement(customBtn);
            return true;
        }
        nextIndex = Math.min(presetIndex + cols, lastIndex);
    }

    setFocusByElement(presetButtons[nextIndex]);
    return true;
}

function handleInputChange(el, delta) {
    if (!el || el.tagName !== "INPUT") return;

    let value = parseInt(el.value, 10) || 0;
    value += delta;

    if (value < 0) value = 0;

    if (el.id === "minutes" || el.id === "seconds") {
        if (value > 59) value = 59;
    }

    el.value = value;
}

function showCustomPanel() {
    customPanel.classList.remove("hidden");
    customBtn.textContent = "Hide Custom Time";
    refreshFocusables();
    setFocusByElement(document.getElementById("hours"));
}

function hideCustomPanel() {
    customPanel.classList.add("hidden");
    customBtn.textContent = "Custom Time";
    refreshFocusables();
}

function toggleCustomPanel() {
    if (customPanel.classList.contains("hidden")) {
        showCustomPanel();
    } else {
        hideCustomPanel();
        setFocusByElement(customBtn);
    }
}

function exitApp() {
    try {
        if (window.tizen && tizen.application) {
            tizen.application.getCurrentApplication().exit();
            return;
        }
    } catch (_) { }

    window.close();
}

function stopTimer() {
    if (timerInterval) {
        clearTimeout(timerInterval);
        timerInterval = null;
    }
    if (timerRafId !== null) {
        cancelAnimationFrame(timerRafId);
        timerRafId = null;
    }
    isTimerRunning = false;
    alarmTriggered = false;

    totalSeconds = 0;
    isPaused = false;
    countdownStartEpochMs = 0;
    timerStartSeconds = 0;
    pausedAtEpochMs = 0;
    totalPausedMs = 0;
    lastDisplayedText = "";

    stopAlarm(true);
    if (setupScreenDetached) {
        setupScreen.style.display = "";
        setupScreenDetached = false;
    }

    timerScreen.classList.remove("active");
    setupScreen.classList.add("active");

    refreshFocusables();
    setFocus(0);
}

function stopAlarm(keepMuted = true) {
    if (!ENABLE_ALARM_AUDIO) return;
    alarmPlaybackToken++;
    if (!alarmSound) return;
    alarmSound.muted = keepMuted;
    alarmSound.pause();
    alarmSound.currentTime = 0;
}

function triggerAlarm() {
    if (!ENABLE_ALARM_AUDIO) return;
    if (!alarmSound) return;
    const playToken = ++alarmPlaybackToken;
    alarmSound.muted = false;
    alarmSound.currentTime = 0;

    alarmSound.play().then(() => {
        if (playToken !== alarmPlaybackToken || !timerScreen.classList.contains("active")) {
            alarmSound.pause();
            alarmSound.currentTime = 0;
        }
    }).catch(() => { });
}

function startTimer() {
    const h = parseInt(document.getElementById("hours").value, 10) || 0;
    const m = parseInt(document.getElementById("minutes").value, 10) || 0;
    const s = parseInt(document.getElementById("seconds").value, 10) || 0;

    totalSeconds = h * 3600 + m * 60 + s;

    if (totalSeconds <= 0) return;

    startCountdown(totalSeconds);
}

function startPreset(seconds) {
    startCountdown(seconds);
}

function startCountdown(seconds) {
    isTimerRunning = true;
    alarmTriggered = false;
    totalSeconds = seconds;
    timerStartSeconds = seconds;
    countdownStartEpochMs = Date.now();
    pausedAtEpochMs = 0;
    totalPausedMs = 0;
    lastDisplayedText = "";

    if (timerInterval) {
        clearTimeout(timerInterval);
    }
    if (timerRafId !== null) {
        cancelAnimationFrame(timerRafId);
        timerRafId = null;
    }

    isPaused = false;

    setupScreen.classList.remove("active");
    timerScreen.classList.add("active");

    // Prioritize first paint of the timer screen before non-critical work.
    requestAnimationFrame(() => {
        updateDisplay(true);
        // After timer screen becomes visible, fully detach the heavy setup DOM.
        setTimeout(() => {
            setupScreen.style.display = "none";
            setupScreenDetached = true;
        }, 0);
    });

    setTimeout(() => {
        stopAlarm(false);
    }, 0);

    scheduleNextTick();
}

function getRemainingSeconds(nowMs) {
    const elapsedMs = nowMs - countdownStartEpochMs - totalPausedMs;
    const remainingMs = timerStartSeconds * 1000 - elapsedMs;
    return Math.max(0, Math.ceil(remainingMs / 1000));
}

function updateDisplay(force = false) {
    const nowMs = Date.now();

    if (isTimerRunning && !isPaused) {
        totalSeconds = getRemainingSeconds(nowMs);
    }

    const remainingMs = Math.max(0, timerStartSeconds * 1000 - (nowMs - countdownStartEpochMs - totalPausedMs));
    const text = formatDisplayFromMs(remainingMs);

    if (!force && text === lastDisplayedText) return;
    lastDisplayedText = text;

    if (totalSeconds === 0 && !alarmTriggered && isTimerRunning) {
        alarmTriggered = true;
        triggerAlarm();
        isTimerRunning = false;
        if (timerInterval) {
            clearTimeout(timerInterval);
            timerInterval = null;
        }
        if (timerRafId !== null) {
            cancelAnimationFrame(timerRafId);
            timerRafId = null;
        }
    }

    timerDisplay.textContent = text;
}

function scheduleNextTick() {
    if (!isTimerRunning || isPaused) return;

    const nowMs = Date.now();
    const remainingMs = timerStartSeconds * 1000 - (nowMs - countdownStartEpochMs - totalPausedMs);

    if (remainingMs <= 0) {
        updateDisplay(true);
        return;
    }

    const currentVisibleTick = Math.ceil(remainingMs / 1000);
    const msToNextBoundary = remainingMs - (currentVisibleTick - 1) * 1000;
    const delay = Math.max(8, Math.min(1000, Math.floor(msToNextBoundary + 1)));

    timerInterval = setTimeout(() => {
        if (!isTimerRunning || isPaused) return;
        timerRafId = requestAnimationFrame(() => {
            timerRafId = null;
            if (!isTimerRunning || isPaused) return;
            updateDisplay(true);
            scheduleNextTick();
        });
    }, delay);
}

function pad(num) {
    return num < 10 ? "0" + num : num;
}

function formatDisplayFromMs(remainingMs) {
    const totalWholeSeconds = Math.floor(remainingMs / 1000);
    const h = Math.floor(totalWholeSeconds / 3600);
    const m = Math.floor((totalWholeSeconds % 3600) / 60);
    const s = totalWholeSeconds % 60;

    if (h > 0) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }
    if (m > 0) {
        return `${m}:${pad(s)}`;
    }
    return `${s}`;
}

function onSetupKeyDown(e) {
    refreshFocusables();
    const el = document.activeElement;

    switch (e.keyCode) {
        case 37: // LEFT
            if (!(el && el.classList.contains("preset") && movePresetFocus(el, "left"))) {
                moveFocus("left");
            }
            e.preventDefault();
            break;

        case 39: // RIGHT
            if (!(el && el.classList.contains("preset") && movePresetFocus(el, "right"))) {
                moveFocus("right");
            }
            e.preventDefault();
            break;

        case 38: // UP
            if (el && el.tagName === "INPUT") {
                handleInputChange(el, +1);
            } else if (el && el.classList.contains("preset")) {
                movePresetFocus(el, "up");
            } else {
                moveFocus("up");
            }
            e.preventDefault();
            break;

        case 40: // DOWN
            if (el && el.tagName === "INPUT") {
                handleInputChange(el, -1);
            } else if (el && el.classList.contains("preset")) {
                movePresetFocus(el, "down");
            } else {
                moveFocus("down");
            }
            e.preventDefault();
            break;

        case 13: // OK
            if (el && el.tagName === "BUTTON") {
                el.click();
            }
            e.preventDefault();
            break;

        case 10009: // BACK
            if (!customPanel.classList.contains("hidden")) {
                hideCustomPanel();
                setFocusByElement(customBtn);
            } else {
                exitApp();
            }
            e.preventDefault();
            break;
    }
}

function onTimerKeyDown(e) {
    switch (e.keyCode) {
        case 13: // OK
            isPaused = !isPaused;
            if (isPaused) {
                pausedAtEpochMs = Date.now();
                if (timerInterval) {
                    clearTimeout(timerInterval);
                    timerInterval = null;
                }
                if (timerRafId !== null) {
                    cancelAnimationFrame(timerRafId);
                    timerRafId = null;
                }
            } else if (pausedAtEpochMs) {
                totalPausedMs += Date.now() - pausedAtEpochMs;
                pausedAtEpochMs = 0;
                updateDisplay(true);
                scheduleNextTick();
            }
            e.preventDefault();
            break;

        case 10009: // BACK
            const confirmCancel = confirm("Cancel timer?");
            if (confirmCancel) {
                stopTimer();
            }
            e.preventDefault();
            break;
    }
}

document.addEventListener("keydown", (e) => {
    if (timerScreen.classList.contains("active")) {
        onTimerKeyDown(e);
    } else {
        onSetupKeyDown(e);
    }
});

document.getElementById("start-btn").addEventListener("click", startTimer);
customBtn.addEventListener("click", toggleCustomPanel);

document.querySelectorAll(".preset").forEach(btn => {
    btn.addEventListener("click", () => {
        const seconds = parseInt(btn.dataset.time, 10);
        if (seconds > 0) {
            startPreset(seconds);
        }
    });
});

document.addEventListener("focusin", (e) => {
    refreshFocusables();
    const idx = focusables.indexOf(e.target);
    if (idx >= 0) {
        currentFocusIndex = idx;
    }
});

window.onload = () => {
    alarmSound = document.getElementById("alarm-sound");
    if (ENABLE_ALARM_AUDIO && alarmSound) {
        alarmSound.preload = "auto";
        alarmSound.load();
    }
    hideCustomPanel();
    refreshFocusables();
    setFocus(0);
};

# Samsung TV Countdown Timer

A Tizen TV web app with a fast, remote-friendly countdown timer UI.

## Features

- Large preset grid from seconds to 24 hours
- Custom time input (`HH`, `MM`, `SS`)
- TV remote navigation with arrow keys + OK
- Full-screen timer display optimized for distance viewing
- Pause/resume with OK while timer is running
- Overtime mode (timer continues below zero in red)
- Looping alarm sound when the timer hits zero

## Controls

### Setup Screen

- `LEFT/RIGHT/UP/DOWN`: Move focus across preset buttons and controls
- `OK`: Select focused preset or activate focused button
- `UP/DOWN` on custom inputs: Increase/decrease value
- `BACK`: Hide custom panel (if open) or exit app

### Timer Screen

- `OK`: Pause or resume timer
- `BACK`: Confirm and cancel timer

## Project Structure

- `index.html`: App layout and screens
- `style.css`: TV-first styling and focus visuals
- `main.js`: Timer logic, focus management, remote key handling
- `config.xml`: Tizen widget/app metadata
- `alarm.mp3`: Alarm audio asset

## Running in Tizen Studio

1. Open this folder as a Tizen Web project.
2. Build the app (`.wgt`).
3. Run on a Samsung TV emulator or a connected TV.

Generated build outputs may appear under `Debug/`.

## Notes

- Designed for Samsung TV/Tizen remote key flow.
- Timer display turns red at `0` and during overtime.
- Audio playback is warmed up before countdown to reduce playback delay on alarm trigger.

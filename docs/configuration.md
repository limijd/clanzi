# Configuration and input behavior

[中文](configuration.zh.md) · [README](../README.md)

The application is named **clanzi**. The existing configuration directory and JSON format identifier retain their historical names for compatibility with saved settings and exports. New exports use the `clanzi-keymap-` filename prefix.

## Files and persistence

Configuration lives in `$XDG_CONFIG_HOME/olanzi-cross-platform/`, or `~/.config/olanzi-cross-platform/` when XDG is unset or relative:

- `keymap.json`: saved mappings; created only on explicit save.
- `preferences.json`: interface preferences, separate from mappings.
- `logs/`: local diagnostics, capped at two 5 MiB files. Ordinary keyboard text and full mappings are not logged.

Editing changes a draft. Imports replace only the draft; exports use the saved configuration. Saving validates and freezes the complete draft, writes and synchronizes a temporary file, then atomically renames it. A write failure preserves the draft and previous active mapping. Corrupt local files are preserved; an explicit repair save first creates a unique `keymap.invalid-YYYYMMDD-HHmmss-N.json` backup.

Six “No action” bindings are valid: saving them enables takeover while discarding the corresponding actions. To stop forwarding, use Pause or Quit. To delete personal data, quit the application before removing its configuration directory.

## Start at login

**Settings → Start at login** is off by default. Turning it on writes the current user's XDG autostart entry `$XDG_CONFIG_HOME/autostart/clanzi.desktop`, or `~/.config/autostart/clanzi.desktop` when XDG is unset or relative; turning it off deletes that file. After you log in to the desktop, the entry starts clanzi with `--hidden`: no window opens, and forwarding starts with the saved mapping once the device and permissions are ready. Open clanzi from the tray or the application menu to show the window.

clanzi starts after desktop login, not at system boot: device permissions belong to the active local session, and the GUI must not run as root.

The entry records the executable path at the moment you turn it on: the AppImage file itself, or the running binary otherwise. After moving or renaming the AppImage, or switching between the `.deb` and `./install.sh` installation, turn the setting off and on again. An entry that the desktop environment disabled with `Hidden=true` is shown as off. Demo mode toggles only in memory and never writes the entry.

## Button and rotary behavior

The three buttons and knob press forward physical down/up edges immediately. There is no mode selector, minimum duration, or long-press threshold. Repeated down reports are ignored; even down/up reports read in one worker iteration produce both output edges. No application-level repeat timer is added.

Rotary actions use 40 ms taps with a minimum 10 ms gap, in a FIFO with up to 32 pending actions. Button holds do not block this queue. Shared output keys remain pressed until their last owner releases them; tapping a key already held does not create another down edge. Held modifiers can affect other shortcuts.

Pause, sleep, mapping replacement, quit, disconnection, offline/unknown status, and output/heartbeat faults release owned keys and clear queued actions. Failed releases remain cleanup debt and require successful cleanup and Retry before forwarding resumes. Observed held buttons must be released before resynchronization. If a release report is lost while the device remains online, Pause or Quit releases a stuck shortcut.

## Battery detection

The top-right indicator and **Settings → Connection** show battery percentage and charging status. Levels at or below 20% appear orange. Hover for voltage and reading age; Settings shows these details directly. Percentage comes from the device, never from a voltage estimate. If percentage is unknown, a valid voltage is displayed instead; otherwise the value is “—”. Unknown charging status is identified in the details.

While clanzi runs in the background, the system tray icon shows the percentage beside it, or the voltage if only voltage is available. A ⚡ marks charging. If the desktop panel hides tray labels, open the tray menu to see the same reading. The label disappears when there is no reading.

A connected, online device is queried immediately and then every 20 seconds, even without a saved keymap. Each reply has a 1-second deadline without blocking key processing or heartbeats. A failed read clears the old value and retries next cycle, without stopping key forwarding. Offline/unknown status, disconnection, connection retry, pause, sleep and quit clear readings. Pausing stops active battery queries; readings resume after the device returns online.

The read-only request is `01 01 02 01`, with reply prefix `81 01 02 11`: plaintext offsets 4–5 contain little-endian millivolts, 6–7 contain little-endian percentage, and offset 10 indicates charging (0/1). Percentages outside 0–100, voltages of 0 or 65535, and charging values other than 0/1 are unknown. Decoding follows Olanzi's captured AU05 reports and open-vibekey's passive parser; automated tests do not establish real-device validation in this project. Demo mode uses simulated battery data and does not access hardware.

## JSON compatibility

Both supported versions use the `olanzi-cross-platform-keymap` format, device `AU05`, and exactly six bindings. Files are limited to 64 KiB. Unknown or duplicate fields, invalid usages/modifiers, and unsupported versions are rejected as a whole. Modifier order is Ctrl, Shift, Alt, Super.

- Version 1 accepts `key` and `none`. Button `key` actions follow physical duration; rotary `key` actions produce timed taps.
- Version 2 also accepts the legacy `hold` action on buttons only. It behaves identically to button `key` actions. Existing files require no startup rewrite or explicit save.
- New mappings use `key`. The editor preserves legacy `hold` actions when editing their key/modifiers and uses version 2 while any remain. Old tap-only builds may interpret version 1 button actions differently and reject version 2 files.

See [the example](../examples/keymap.json) for a complete file. Validate a file with:

```sh
cargo run --offline --bin clanzi-validate -- examples/keymap.json
```

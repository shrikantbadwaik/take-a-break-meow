# Take a break, Meow

**Take a break, Meow** is a small desktop timer for focus and rest. You choose how long you want to stay “on task,” then how long to recover. When your usage time runs out, a full-screen break appears—complete with a friendly cat—until the break countdown finishes. After that, your usage timer starts again automatically.

The idea is similar in spirit to wellness timers that interrupt scrolling with a cute interruption; this app runs on your desktop as a standalone Electron app.

The settings window opens first. Minimize or hide it and use the tray icon (menu bar on macOS, notification area on Windows) to open the app again while a session is running.

## How to use

1. **Usage budget (minutes)** — How long your session runs before a break. Default is 60.
2. **Break (minutes)** — How long the full-screen break lasts. Default is 5.
3. Click **Start session**. The window can hide; the tray shows remaining time until the break.
4. When usage time ends, the **break overlay** appears until the break timer reaches zero. You cannot skip it from the overlay (use **Stop session** from the tray if you need to cancel entirely).
5. **Stop** ends the session and clears timers.

**Note:** This desktop build counts time **while the session is running** (wall-clock for that session). It does not detect which browser tab is active; browser extensions can do that with page access. Here, you start the session when you want that budget to apply.

## Privacy

The app does not send data to external servers by default; it is a local timer and UI. If you add analytics or updates later, disclose them in your Store listing and privacy statement.

## License

MIT (see `package.json` unless you add a separate `LICENSE` file).

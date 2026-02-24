const { app, globalShortcut } = require('electron');
const fs = require('fs');

const logPath = require('path').join(__dirname, 'shortcut_test.log');
const log = (msg) => {
    fs.appendFileSync(logPath, msg + '\n');
    console.log(msg);
};

app.whenReady().then(() => {
    fs.writeFileSync(logPath, '--- Shortcut Test ---\n');
    log("Single Quote (Alt+'): " + globalShortcut.register("Alt+'", () => { }));
    log("Backquote (Alt+`): " + globalShortcut.register("Alt+`", () => { }));
    log("Plus (Alt+Plus): " + globalShortcut.register("Alt+Plus", () => { }));
    log("Minus (Alt+Minus): " + globalShortcut.register("Alt+Minus", () => { }));
    log("Minus symbol (Alt+-): " + globalShortcut.register("Alt+-", () => { }));

    // Test alternative names
    log("Quote (Alt+Quote): " + globalShortcut.register("Alt+Quote", () => { }));
    log("Backquote string (Alt+Backquote): " + globalShortcut.register("Alt+Backquote", () => { }));

    setTimeout(() => app.quit(), 500);
});

const electron = require('electron');
const { app, globalShortcut } = electron;
const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'shortcut_results.txt');

app.on('ready', () => {
    const tests = [
        "Alt+Plus",
        "Alt++",
        "Alt+Minus",
        "Alt+-",
        "Alt+*",
        "Alt+8",
        "Alt+NumpadAdd",
        "Alt+NumpadSubtract"
    ];

    let results = "Shortcut Registration Results:\n";
    tests.forEach(s => {
        try {
            const ret = globalShortcut.register(s, () => { });
            results += `${s}: ${ret ? "SUCCESS" : "FAILED"}\n`;
            if (ret) globalShortcut.unregister(s);
        } catch (e) {
            results += `${s}: ERROR - ${e.message}\n`;
        }
    });

    fs.writeFileSync(logFile, results);
    app.quit();
});

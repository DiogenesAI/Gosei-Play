const DEBUG = true;

function log(message) {
    if (DEBUG) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }
}

module.exports = { log, DEBUG };

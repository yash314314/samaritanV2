const { BrowserWindow } = require("electron");
const axios = require("axios");

const USER_ID = "7007b337-6f7b-4d6a-86f9-dc4da4ed48c4";
const API_URL = "http://localhost:4000/focus/active/status";

let pollInterval = null;

async function pollSessionStatus() {
  try {
    const { data } = await axios.get(`${API_URL}?userId=${USER_ID}`);
    
    if (data.active) {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) {
        win.webContents.send("session-tick", {
          remaining: data.session.remainingMinutes * 60,
          planned: data.session.plannedMinutes,
          elapsed: data.session.elapsedMinutes,
          focusScore: data.session.focusScore,
          violationCount: data.session.violationCount
        });
      }
    }
  } catch (err) {
    // API might be down, ignore
  }
}

function startSessionPoller() {
  if (pollInterval) return;
  
  pollInterval = setInterval(pollSessionStatus, 30000); // Every 30 seconds
  pollSessionStatus(); // Immediate first call
}

function stopSessionPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

module.exports = { startSessionPoller, stopSessionPoller };
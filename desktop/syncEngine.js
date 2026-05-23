const Store = require("electron-store");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const store = new Store();
const deviceId =
  store.get("deviceId") || uuidv4();

store.set("deviceId", deviceId);
const CLOUD_API = "http://localhost:4000";

async function sync() {
  const sessions = store.get("sessions") || [];
  if (sessions.length === 0) return;
   //console.log("session: ", sessions);
   console.log("device", deviceId);
  try {
    await axios.post(`${CLOUD_API}/sync/sessions`, {
      sessions: sessions.map(session => ({
        ...session,
        id: uuidv4()
      }))
    });

    store.set("sessions", []);
    console.log("Synced successfully");
  } catch (err) {
    console.log("Sync failed, will retry");
  }
}

function startSyncLoop() {
  setInterval(sync, 4 * 1000);
}

module.exports = { startSyncLoop };
chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

const SESSION_EXPIRATION_IN_MIN = 30;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getOrCreateClientId") {
        getOrCreateClientId().then(clientId => {
            sendResponse({ clientId });
        });
        return true; // Indicates an asynchronous response.
    } else if (request.action === "getOrCreateSessionId") {
        getOrCreateSessionId().then(sessionId => {
            sendResponse({ sessionId });
        });
        return true; // Indicates an asynchronous response.
    }
});

async function getOrCreateClientId() {
    let { clientId } = await chrome.storage.local.get('clientId');
    if (!clientId) {
        clientId = self.crypto.randomUUID();
        await chrome.storage.local.set({ clientId });
    }
    return clientId;
}

async function getOrCreateSessionId() {
    let { sessionData } = await chrome.storage.session.get('sessionData');
    const currentTimeInMs = Date.now();
    if (sessionData && ((currentTimeInMs - sessionData.timestamp) / 60000 > SESSION_EXPIRATION_IN_MIN)) {
        sessionData = null;
    }
    if (!sessionData) {
        sessionData = { session_id: currentTimeInMs.toString(), timestamp: currentTimeInMs };
        await chrome.storage.session.set({ sessionData });
    } else {
        sessionData.timestamp = currentTimeInMs;
        await chrome.storage.session.set({ sessionData });
    }
    return sessionData.session_id;
}

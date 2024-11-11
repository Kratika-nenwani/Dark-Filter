const activationPrefix = "activation_";
const browserAPI = chrome;

const storage = browserAPI.storage.session ? browserAPI.storage.session : browserAPI.storage.local;

async function getActivation(tabId) {
    try {
        return Object.values(await storage.get(`${activationPrefix}${tabId}`))[0];
    } catch (error) {
        console.error("Error in getActivation:", error);
    }
}

async function setActivation(tabId, activation) {
    try {
        return await storage.set({ [`${activationPrefix}${tabId}`]: activation });
    } catch (error) {
        console.error("Error in setActivation:", error);
    }
}

async function removeActivation(tabId) {
    try {
        return await storage.remove(`${activationPrefix}${tabId}`);
    } catch (error) {
        console.error("Error in removeActivation:", error);
    }
}

async function getActivationOrSetDefault(tabId) {
    try {
        let activation = await getActivation(tabId);

        if (activation === undefined) {
            activation = true;
            await setActivation(tabId, activation);
        }

        return activation;
    } catch (error) {
        console.error("Error in getActivationOrSetDefault:", error);
    }
}

browserAPI.runtime.onMessage.addListener(handleMessage);

function handleMessage(message, sender, sendResponse) {
    if ("countVisible" in message) {
        getActivation(sender.tab.id).then((activation) => {
            if (activation === true) {
                displayPatternCount(message.countVisible, sender.tab.id);
            }
            sendResponse({ success: true });
        });
    } else if ("enableExtension" in message && "tabId" in message) {
        setActivation(message.tabId, message.enableExtension).then(() => {
            if (message.enableExtension === false) {
                displayPatternCount("", message.tabId);
            }
            sendResponse({ success: true });
        });
    } else if ("action" in message && message.action == "getActivationState") {
        let tabId = message.tabId ? message.tabId : sender.tab.id;

        getActivationOrSetDefault(tabId).then((activation) => {
            sendResponse({ isEnabled: activation });
        });
    } else {
        sendResponse({ success: false });
    }

    return true;
}

browserAPI.tabs.onReplaced.addListener(handleTabReplaced);

function handleTabReplaced(addedTabId, removedTabId) {
    setActivation(addedTabId, getActivation(removedTabId));
    removeActivation(removedTabId);
}

browserAPI.tabs.onRemoved.addListener(handleTabRemoved);

function handleTabRemoved(tabId, removeInfo) {
    removeActivation(tabId);
}

const icons_default = browserAPI.runtime.getManifest().icons;
const icons_disabled = {};

for (let resolution in icons_default) {
    icons_disabled[resolution] = `${icons_default[resolution].slice(0, -4)}_grey.png`;
}

browserAPI.tabs.onUpdated.addListener(handleTabUpdated);

function handleTabUpdated(tabId, changeInfo, tab) {
    if (tab.url.toLowerCase().startsWith("http://") || tab.url.toLowerCase().startsWith("https://")) {
        browserAPI.action.setIcon({
            path: icons_default,
            tabId: tabId
        });
    } else {
        browserAPI.action.setIcon({
            path: icons_disabled,
            tabId: tabId
        });
    }
}

function displayPatternCount(count, tabId) {
    browserAPI.action.setBadgeText({
        tabId: tabId,
        text: "" + count
    });

    let bgColor = [255, 0, 0, 255];
    if (count == 0) {
        bgColor = [0, 255, 0, 255];
    }

    browserAPI.action.setBadgeBackgroundColor({
        tabId: tabId,
        color: bgColor
    });
}

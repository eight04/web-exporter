import browser from 'webextension-polyfill';

export const currentTab = $state({id: -1, url: ""});
// FIXME: derived runes can't be exported?...
// export const currentUrl = $derived(currentTab.url);

browser.tabs.query({active: true, currentWindow: true}).then((tabs) => {
  if (tabs.length > 0) {
    setNewTab(tabs[0]);
  }
});

browser.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await browser.tabs.get(activeInfo.tabId);
  setNewTab(tab);
});

function setNewTab(tab) {
  const tabSwitched = currentTab.id !== tab.id;
  Object.assign(currentTab, tab);
  if (tabSwitched) {
    browser.tabs.onUpdated.removeListener(onUpdated);
    browser.tabs.onUpdated.addListener(onUpdated, {tabId: currentTab.id});
  }
}

function onUpdated(updatedTabId, changeInfo, tab) {
  if (updatedTabId === currentTab.id) {
    Object.assign(currentTab, tab);
  }
}


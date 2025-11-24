<script>
import browser from "webextension-polyfill";
import {tick} from "svelte";

import { _ } from "../lib/i18n.mjs";
import {mutex} from "../lib/mutex.mjs";

import sites from "../sites/index.mjs";
import {currentTab} from "./current-tab.svelte.js";

const MAX_LOGS = 100;
const logs = $state([]); // { id: number, message: string }[]
const port = browser.runtime.connect({ name: "logger" });
let logger;
let recording = $state(false);
let exportType = $state("media");

const allSpiders = [];
for (const site of Object.values(sites)) {
  if (!site.spiders) continue;
  for (const key in site.spiders) {
    allSpiders.push({
      id: key,
      site_id: site.id,
      url: new URLPattern(site.spiders[key].url),
    });
  }
}

let spider = $state(null);
let spiderRunning = $state(false);

const updateSpiderStatus = mutex(async (tabId) => {
  const result = await browser.runtime.sendMessage({ method: "isSpiderRunning", tabId });
  spiderRunning = result;
}, { maxPending: 2 });

$effect(() => {
  updateSpiderStatus(currentTab.id);
});

browser.runtime.onMessage.addListener((msg) => {
  if (msg.method === "spiderStatusChanged") {
    updateSpiderStatus(currentTab.id);
  }
});

const currentUrl = $derived(currentTab.url);
let spiders = $derived(allSpiders.filter(s => s.url.test(currentUrl)));

function pushLog(arg) {
  logs.push(arg);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }
}

browser.runtime.sendMessage({ method: "isRecording" }).then((isRecording) => {
  recording = isRecording;
});

port.onMessage.addListener((msg) => {
  if (msg.extend) {
    const log = logs.find(l => l.id === msg.id);
    log.message += msg.message;
  } else {
    pushLog(msg);
    tick().then(() => {
      logger.scroll({ top: logger.scrollHeight, behavior: "smooth" });
    });
  }
});

function toggleRecording() {
  recording = !recording;
  if (recording) {
    browser.runtime.sendMessage({ method: "startRecording" });
  } else {
    browser.runtime.sendMessage({ method: "stopRecording" });
  }
}

async function exportData() {
  let result;
  try {
    result = await disableButton(this, () => browser.runtime.sendMessage({ method: "exportData", type: exportType }) );
  } catch (e) {
    alert(e.message || String(e));
    return;
  }
  if (!result.length) {
    alert(_("exportNoData"));
    return;
  }
  await navigator.clipboard.writeText(result.text);
  alert(_("exportCopied", [ result.length ]));
}

function toggleSpider() {
  if (!spider) {
    alert(_("sidebarSpiderNoSelection"));
    return;
  }
  disableButton(this, async () => {
    if (spiderRunning) {
      await browser.runtime.sendMessage({ method: "stopSpider", tabId: currentTab.id});
    } else {
      await browser.runtime.sendMessage({ method: "startSpider", site_id: spider.site_id, id: spider.id, tabId: currentTab.id })
    }
  }).catch(err => {
    alert(err.message || String(err));
  });
}

function deleteDB() {
  if (confirm(_("storeDeleteDBConfirm"))) {
    browser.runtime.sendMessage({ method: "deleteDatabase" }).then(() => {
      logs.length = 0;
      pushLog({ id: Date.now(), message: _("storeDeleteDBSuccess") });
    });
  }
}

async function disableButton(button, action) {
  button.disabled = true;
  try {
    return await action();
  } finally {
    button.disabled = false;
  }
}
</script>

<div class="container">
  <div class="actions">
    <button onclick={toggleRecording}>
      {#if recording}
        {_("sidebarBtnStopRecording")}
      {:else}
        {_("sidebarBtnStartRecording")}
      {/if}
    </button>
    <label>
      <span>{_("sidebarExportTypeLabel")}</span>
      <select bind:value={exportType}>
        <option value="media">{_("sidebarExportTypeMedia")}</option>
        <option value="url">{_("sidebarExportTypeUrl")}</option>
      </select>
    </label>
    <button onclick={exportData}>
      {_("sidebarBtnExport")}
    </button>
    <label>
      <span>{_("sidebarSpiderLabel")}</span>
      <select bind:value={spider}>
        {#each spiders as spider}
          <option value={spider}>{spider.id}</option>
        {/each}
      </select>
    </label>
    <button onclick={toggleSpider}>
      {#if spiderRunning}
        {_("sidebarSpiderStopBtn")}
      {:else}
        {_("sidebarSpiderStartBtn")}
      {/if}
    </button>
    <button onclick={deleteDB}>
      {_("sidebarBtnDeleteDB")}
    </button>
  </div>
  <span class="logger-head">
    Logs
  </span>
  <ul class="logger" bind:this={logger}>
    {#each logs as log (log.id)}
      <li>{log.message}</li>
    {/each}
  </ul>
</div>

<style>
.container {
  display: grid;
  grid-template-rows: auto auto 1fr;
  height: 100vh;
  overflow: hidden;
}
.actions {
  text-align: center;
  button {
    margin: 5px;
  }
  select {
    display: inline-block;
    width: auto;
  }
  > * {
    white-space: nowrap;
  }
}
.logger-head {
  text-align: center;
  display: none;
}
.logger {
  overflow: auto;
  padding: 5px;
  margin: 5px;
  list-style: none;
  white-space: nowrap;
  background-color: var(--c-bg-l2);
}
</style>

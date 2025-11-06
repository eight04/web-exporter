<script>
import browser from "webextension-polyfill";
import {tick} from "svelte";
import { _ } from "../lib/i18n.mjs";

const logs = $state([]); // { id: number, message: string }[]
const port = browser.runtime.connect({ name: "logger" });
let logger;
let recording = $state(false);

browser.runtime.sendMessage({ method: "isRecording" }).then((isRecording) => {
  recording = isRecording;
});

port.onMessage.addListener((msg) => {
  if (msg.extend) {
    const log = logs.find(l => l.id === msg.id);
    log.message += msg.message;
  } else {
    logs.push(msg);
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

async function startExport() {
  const currentTab = await browser.tabs.query({ active: true, currentWindow: true });
  await browser.tabs.create({ url: browser.runtime.getURL("export.html"), openerTabId: currentTab[0].id });
}

async function exportMedia() {
  const tasks = await disableButton(this, () => browser.runtime.sendMessage({ method: "exportMedia" }));
  if (tasks.length === 0) {
    alert(_("exportNoData"));
    return;
  }
  const text = tasks.map(t => `${t.url}#out=${t.filename}`).join("\n");
  await navigator.clipboard.writeText(text);
  alert(_("exportCopied", { count: tasks.length }));
}

function deleteDB() {
  if (confirm(_("storeDeleteDBConfirm"))) {
    browser.runtime.sendMessage({ method: "deleteDatabase" }).then(() => {
      logs.length = 0;
      logs.push({ id: Date.now(), message: _("storeDeleteDBSuccess") });
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
    <button onclick={exportMedia}>
      {_("sidebarBtnExportMedia")}
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

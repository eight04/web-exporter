<script>
import browser from "webextension-polyfill";
import {tick} from "svelte";

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

async function exportMediaURL() {
  const urls = await disableButton(this, () => browser.runtime.sendMessage({ method: "prepareExportMediaURL" }));
  if (urls.length === 0) {
    alert("No media URLs to export.");
    return;
  }
  prompt("Copy the media URLs below:", urls.join("\n"));
}

function deleteDB() {
  if (confirm("Are you sure you want to delete the database? This action cannot be undone.")) {
    browser.runtime.sendMessage({ method: "deleteDatabase" }).then(() => {
      logs.length = 0;
      logs.push({ id: Date.now(), message: "Database deleted." });
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
        Stop recording
      {:else}
        Start recording
      {/if}
    </button>
    <button onclick={exportMediaURL}>
      Export media URL
    </button>
    <button onclick={deleteDB}>
      Delete database
    </button>
  </div>
  <span>
    Logs:
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
.logger {
  overflow: auto;
  padding: 0;
  margin: 0;
  list-style: none;
  white-space: nowrap;
}
</style>

<script>
import browser from "webextension-polyfill";

import { _ } from "../lib/i18n.mjs";

const defaultConfigIds = $state([]);
fetch(browser.runtime.getURL("sites/index.txt"))
  .then(res => res.text())
  .then(text => {
    for (const line of text.split("\n")) {
      const id = line.trim();
      if (id) defaultConfigIds.push(id);
    }
  });

const configIds = $state([]);
browser.storage.local.get("configIds").then(result => {
  if (result.configIds) {
    configIds.push(...result.configIds);
  }
});

let currentConfigId = $state("");
let configContent = $state("");
let statusText = $state("");

$effect(() => {
  if (!currentConfigId) return;
  if (currentConfigId.startsWith("__default_")) {
    const id = currentConfigId.slice("__default_".length);
    fetch(browser.runtime.getURL(`sites/${id}.yml`))
      .then(res => res.text())
      .then(text => {
        configContent = text;
        setClean();
      });
  } else {
    const path = `config/${currentConfigId}`;
    browser.storage.local.get(path).then(result => {
      configContent = result[path] || "";
      setClean();
    });
  }
});

async function save() {
  if (!currentConfigId) return;
  if (currentConfigId.startsWith("__default_")) {
    const id = currentConfigId.slice("__default_".length);
    if (configIds.includes(id)) {
      statusText = _("optionsErrorConfigExists", id);
      return;
    }
    configIds.push(id);
    currentConfigId = id;
    const path = `config/${id}`;
    await browser.storage.local.set({ configIds: $state.snapshot(configIds), [path]: configContent });
  } else {
    const path = `config/${currentConfigId}`;
    await browser.storage.local.set({ [path]: configContent });
  }
  statusText = _("saved");
  browser.runtime.sendMessage({ method: "configUpdated", id: currentConfigId });
}

async function deleteConfig() {
  if (!currentConfigId || currentConfigId.startsWith("__default_")) return;
  if (!confirm(_("optionsConfigDeleteConfirm", currentConfigId))) return;
  const id = currentConfigId;
  const path = `config/${id}`;
  const newConfigIds = configIds.filter(cid => cid !== id);
  await browser.storage.local.set({ configIds: newConfigIds });
  await browser.storage.local.remove(path);
  currentConfigId = "";
  configContent = "";
  configIds.length = 0;
  configIds.push(...newConfigIds);
  statusText = _("deleted");
  browser.runtime.sendMessage({ method: "configUpdated", id });
}

function setDirty() {
  statusText = "*";
}

function setClean() {
  statusText = "";
}
</script>

<div class="container">
  <div class="actions">
    <label>
      <!-- <span>{_("optionsCurrentConfig")}</span> -->
      <select bind:value={currentConfigId}>
        <optgroup label={_("configOptionDefault")}>
          {#each defaultConfigIds as id}
            <option value="__default_{id}">{id}</option>
          {/each}
        </optgroup>
        <optgroup label={_("configOptionUser")}>
          {#each configIds as id}
            <option value={id}>{id}</option>
          {/each}
        </optgroup>
      </select>
    </label>
    <button onclick={save}>
      {_("save")}
    </button>
    <button onclick={deleteConfig} disabled={!currentConfigId || currentConfigId.startsWith("__default_")}>
      {_("delete")}
    </button>
    <span class="status-text">{statusText}</span>
  </div>
  <textarea bind:value={configContent} rows="20" cols="80" class="codearea" oninput={setDirty}></textarea>
</div>

<style>
.container {
  display: grid;
  grid-template-rows: auto 1fr;
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
.codearea {
  font-family: monospace;
}
</style>

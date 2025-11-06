<script>
import browser from "webextension-polyfill";

const logs = $state([]); // { id: number, message: string }[]
const port = browser.runtime.connect({ name: "logger" });
let recording = $state(false);

browser.runtime.sendMessage({ method: "isRecording" }).then((isRecording) => {
  recording = isRecording;
});

port.onMessage.addListener((msg) => {
  if (msg.extend) {
    const log = logs.find(l => l.id === msg.id);
    log.message += msg.message;
  } else {
    logs.unshift(msg);
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
</script>
<button onclick={toggleRecording}>
  {#if recording}
    Stop recording
  {:else}
    Start recording
  {/if}
</button>
Logs:
<ul class="logger">
  {#each logs as log (log.id)}
    <li>{log.message}</li>
  {/each}
</ul>

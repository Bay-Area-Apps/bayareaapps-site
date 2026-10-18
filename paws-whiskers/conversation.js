"use strict";
const base = "https://vet-helpline-development.dkjmmz6whh.workers.dev";
const match = location.hash.match(/^#thread=([a-f0-9]{32})\.([a-f0-9]{64})$/);
const status = document.getElementById("status");
const input = document.getElementById("message");
const attachmentInput = document.getElementById("replyAttachments");
const selectedFiles = document.getElementById("replyFileList");
const clearFiles = document.getElementById("clearReplyFiles");
const send = document.getElementById("send");
let loading = false, sending = false, pending = null, messagesSignature = null;
let fileSelection = 0;

function attachmentError(files) {
  if (files.length > 4) return "Choose up to 4 files per message.";
  if (files.some(file => file.size > 10 * 1024 * 1024)) return "Each file must be 10 MB or smaller. Your files are still selected; choose a smaller file to continue.";
  if (files.reduce((total, file) => total + file.size, 0) > 40 * 1024 * 1024) return "Keep the total attachment size at 40 MB or less.";
  return "";
}
function renderSelectedFiles() {
  const files = Array.from(attachmentInput.files || []);
  selectedFiles.replaceChildren();
  for (const file of files) {
    const item = document.createElement("li");
    item.textContent = file.name + " · " + (file.size / 1048576).toFixed(1) + " MB";
    selectedFiles.append(item);
  }
  clearFiles.hidden = files.length === 0;
  const error = attachmentError(files);
  notice(error, Boolean(error));
}
function safeAttachmentURL(value) {
  try {
    const url = new URL(value);
    return url.origin === base && url.pathname.startsWith("/attachments/") && !url.username && !url.password && !url.hash ? url.href : null;
  } catch { return null; }
}

// Keep stored service names stable; present the current support names to clients.
function serviceDisplayName(service) {
  return String(service || "")
    .replace(/^Quick Question(?= —| ·|$)/, "Focused Guidance")
    .replace(/^Detailed Guidance(?= —| ·|$)/, "In-Depth Support")
    .replace(/^Free Community Support(?= —| ·|$)/, "Free Advice");
}
function approvalMessage(paymentStatus) {
  if (paymentStatus === "Awaiting approval") return "Your support request was received. You have not been charged. Payment becomes available after I confirm availability.";
  if (paymentStatus === "Declined — no charge") return "The operator is unavailable for this support request. Your request was declined without payment.";
  if (paymentStatus === "Payment requested") return "Your support request is approved and ready for payment. Complete checkout before your paid support begins.";
  if (paymentStatus === "No payment required") return "Free Advice — no payment is needed.";
  if (paymentStatus === "Paid") return "Your payment has been received. Check this page for your reply.";
  return "";
}
function notice(text, error = false) {
  status.textContent = text;
  status.className = error ? "error" : "";
  document.getElementById("retry").hidden = !error || !match || sending;
}
function updateControls() {
  send.disabled = loading || sending;
  document.getElementById("refresh").disabled = loading || sending;
  document.getElementById("retry").disabled = loading || sending;
  input.disabled = sending;
  attachmentInput.disabled = sending;
  clearFiles.disabled = sending;
  document.getElementById("send-label").textContent = sending ? "Sending…" : pending && input.value.trim() === pending.text && fileSelection === pending.fileSelection ? "Retry message" : "Send message";
}
async function api(method = "GET", body = null) {
  const controller = new AbortController();
  const files = body?.files || [];
  const uploadBytes = files.reduce((total, file) => total + file.size, 0);
  const timer = setTimeout(() => controller.abort(), Math.max(30000, 30000 + Math.ceil(uploadBytes / (128 * 1024)) * 1000));
  let requestBody;
  if (body && files.length) {
    requestBody = new FormData();
    requestBody.append("id", body.id);
    requestBody.append("text", body.text);
    for (const file of files) requestBody.append("attachments", file, file.name);
  } else if (body) requestBody = JSON.stringify({ id: body.id, text: body.text });
  try {
    const response = await fetch(base + "/careline/client/threads/" + match[1] + (body ? "/messages" : ""), {
      method,
      headers: { Authorization: "Bearer " + match[2], ...(body && !files.length ? { "Content-Type": "application/json" } : {}) },
      body: requestBody,
      cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "This conversation could not load.");
    return data;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError) throw new Error("The connection was interrupted. Retry; your message and selected files stay here while this page remains open.");
    throw error;
  } finally { clearTimeout(timer); }
}
function render(data) {
  document.getElementById("thread").hidden = false;
  document.getElementById("pet").textContent = data.petName ? "Your conversation about " + data.petName : "Your private conversation";
  document.getElementById("service").textContent = serviceDisplayName(data.service || "Your support request").replace(" — Private Message", "");
  document.getElementById("question").textContent = data.question;
  document.getElementById("payment").textContent = data.paymentStatus;
  document.getElementById("payment-badge").className = "payment-badge" +
    (["Paid", "No payment required"].includes(data.paymentStatus) ? " positive" : data.paymentStatus === "Declined — no charge" ? " negative" : "");
  document.getElementById("availability").textContent = approvalMessage(data.paymentStatus);
  document.getElementById("phone-note").hidden = !/phone/i.test(data.service || "");
  const pay = document.getElementById("pay");
  pay.hidden = true;
  pay.href = "";
  if (data.paymentStatus === "Payment requested" && data.checkoutURL) {
    try {
      const url = new URL(data.checkoutURL);
      if (url.origin === base && url.pathname === "/pay" && !url.hash && !url.username && !url.password) {
        pay.href = url.href;
        pay.hidden = false;
      }
    } catch { /* A malformed checkout link must never prevent access to messages. */ }
  }
  const list = document.getElementById("messages");
  document.getElementById("empty-messages").hidden = data.messages.length > 0;
  list.hidden = data.messages.length === 0;
  const signature = JSON.stringify(data.messages);
  if (signature === messagesSignature) return;
  messagesSignature = signature;
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
  const oldScroll = list.scrollTop;
  list.replaceChildren();
  for (const message of data.messages) {
    const item = document.createElement("li"), heading = document.createElement("div");
    const name = document.createElement("strong"), text = document.createElement("p"), time = document.createElement("time");
    item.className = message.sender === "business" ? "business" : "client";
    heading.className = "message-header";
    name.textContent = message.sender === "business" ? "Paws & Whiskers Help Line" : "You";
    text.textContent = message.text;
    time.dateTime = message.createdAt;
    time.textContent = new Date(message.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    heading.append(name, time);
    item.append(heading, text);
    if (Array.isArray(message.attachments)) {
      const attachments = document.createElement("ul");
      attachments.className = "message-attachments";
      attachments.setAttribute("aria-label", "Attached files");
      for (const file of message.attachments) {
        const href = safeAttachmentURL(file.url);
        if (!href) continue;
        const row = document.createElement("li"), link = document.createElement("a");
        link.href = href;
        link.textContent = file.name || "Download attachment";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        row.append(link);
        attachments.append(row);
      }
      if (attachments.childNodes.length) item.append(attachments);
    }
    list.append(item);
  }
  list.scrollTop = nearBottom ? list.scrollHeight : oldScroll;
}
async function refresh(manual = false) {
  if (!match || loading || sending || document.hidden) return;
  loading = true;
  updateControls();
  try {
    render(await api());
    // Keep a failed send's retry instructions visible until the draft is sent.
    if (!pending) {
      const fileError = attachmentError(Array.from(attachmentInput.files || []));
      notice(fileError || (manual ? "Conversation updated. Keep this private page bookmarked." : ""), Boolean(fileError));
    }
  } catch (error) {
    notice(error.message, true);
    if (/no longer|invalid|unavailable/.test(error.message)) document.getElementById("thread").hidden = true;
  } finally {
    loading = false;
    updateControls();
  }
}
document.getElementById("reply").addEventListener("submit", async event => {
  event.preventDefault();
  const text = input.value.trim();
  const files = Array.from(attachmentInput.files || []);
  if (!match || text.length > 4000 || loading || sending) return;
  if (!text && !files.length) { notice("Add a message or choose a file before sending.", true); return; }
  const error = attachmentError(files);
  if (error) { notice(error, true); return; }
  if (!pending || pending.text !== text || pending.fileSelection !== fileSelection) pending = { id: crypto.randomUUID().replaceAll("-", ""), text, files, fileSelection };
  sending = true;
  updateControls();
  notice("Sending…");
  try {
    render(await api("POST", pending));
    if (input.value.trim() === text) input.value = "";
    attachmentInput.value = "";
    fileSelection++;
    renderSelectedFiles();
    pending = null;
    notice(files.length ? "Files sent with your message. Return to this page to check for your reply." : "Message sent. Return to this page to check for your reply.");
  } catch (error) { notice(error.message, true); }
  finally { sending = false; updateControls(); }
});
input.addEventListener("input", updateControls);
attachmentInput.addEventListener("change", () => { fileSelection++; renderSelectedFiles(); updateControls(); });
clearFiles.addEventListener("click", () => { attachmentInput.value = ""; fileSelection++; renderSelectedFiles(); updateControls(); });
document.getElementById("refresh").addEventListener("click", () => refresh(true));
document.getElementById("retry").addEventListener("click", () => refresh(true));
document.getElementById("copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    notice("Private link copied. Keep it safe.");
  } catch { notice("Bookmark this page or copy its address from your browser."); }
});
document.getElementById("skip").addEventListener("click", event => {
  event.preventDefault();
  document.getElementById("main").focus();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
window.addEventListener("hashchange", () => location.reload());
if (match) { refresh(); setInterval(() => refresh(), 15000); }
else notice("Open the private conversation link you received after submitting your support request.", true);

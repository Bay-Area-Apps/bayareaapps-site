"use strict";
const base = "https://vet-helpline-development.dkjmmz6whh.workers.dev";
const match = location.hash.match(/^#thread=([a-f0-9]{32})\.([a-f0-9]{64})$/);
const status = document.getElementById("status");
const input = document.getElementById("message");
const send = document.getElementById("send");
let loading = false, sending = false, pending = null, messagesSignature = null;

function approvalMessage(paymentStatus) {
  if (paymentStatus === "Awaiting approval") return "Your question was received. You have not been charged. Payment becomes available after I confirm availability.";
  if (paymentStatus === "Declined — no charge") return "The operator is unavailable for this question. Your request was declined without payment.";
  if (paymentStatus === "Payment requested") return "Your question is approved and ready for payment. Complete checkout before your paid response.";
  if (paymentStatus === "No payment required") return "Free Community Support — no payment is needed.";
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
  document.getElementById("send-label").textContent = sending ? "Sending…" : pending && input.value.trim() === pending.text ? "Retry message" : "Send message";
}
async function api(method = "GET", body = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(base + "/careline/client/threads/" + match[1] + (body ? "/messages" : ""), {
      method,
      headers: { Authorization: "Bearer " + match[2], ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "This conversation could not load.");
    return data;
  } catch (error) {
    if (error.name === "AbortError" || error instanceof TypeError) throw new Error("The connection was interrupted. Retry; your message stays here.");
    throw error;
  } finally { clearTimeout(timer); }
}
function render(data) {
  document.getElementById("thread").hidden = false;
  document.getElementById("pet").textContent = data.petName ? "Your conversation about " + data.petName : "Your private conversation";
  document.getElementById("service").textContent = (data.service || "Your request").replace(" — Private Message", "");
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
    if (!pending) notice(manual ? "Conversation updated. Keep this private page bookmarked." : "");
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
  if (!match || !text || text.length > 4000 || loading || sending) return;
  if (!pending || pending.text !== text) pending = { id: crypto.randomUUID().replaceAll("-", ""), text };
  sending = true;
  updateControls();
  notice("Sending…");
  try {
    render(await api("POST", pending));
    if (input.value.trim() === text) input.value = "";
    pending = null;
    notice("Message sent. Return to this page to check for your reply.");
  } catch (error) { notice(error.message, true); }
  finally { sending = false; updateControls(); }
});
input.addEventListener("input", updateControls);
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
else notice("Open the private conversation link you received after submitting your question.", true);

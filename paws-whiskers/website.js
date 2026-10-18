"use strict";
// Guided intake uses the existing payload/relay contract. All drafts and retry
// credentials stay in this page's memory; no client data is persisted locally.
if (window.location.hostname === "jmal9767.github.io") {
  window.location.replace("https://bayareaapps.com/paws-whiskers/" + window.location.search + window.location.hash);
}
var currentStep = 0;
var submissionPending = false;
var serviceValues = {
  quick: "Quick Question — Private Message · $10",
  detailed: "Detailed Guidance — Private Message · $15",
  phone: "Phone Support · $25",
  free: "Free Community Support — Private Message"
};
function byID(id) { return document.getElementById(id); }
function showFormNotice(message) {
  var notice = byID("formNotice"); notice.textContent = message; notice.hidden = false;
  notice.focus({ preventScroll: true }); notice.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function clearFormNotice() { byID("formNotice").hidden = true; byID("formNotice").textContent = ""; }
function isTrustedStatusURL(value) {
  try { var url = new URL(value); return url.origin === "https://vet-helpline-development.dkjmmz6whh.workers.dev" && url.pathname === "/pay" && !url.username && !url.password && !url.hash; }
  catch (_) { return false; }
}
function canonicalConversationURL(value) {
  var url = new URL(value);
  var legacy = url.origin === "https://paws-whiskers-care-line.dkjmmz6whh.workers.dev" && url.pathname === "/conversation.html";
  var company = url.origin === "https://bayareaapps.com" && url.pathname === "/paws-whiskers/conversation.html";
  if ((!legacy && !company) || url.search || url.username || url.password || !/^#thread=[a-f0-9]{32}\.[a-f0-9]{64}$/.test(url.hash)) throw new Error("Your private conversation could not be verified.");
  return "https://bayareaapps.com/paws-whiskers/conversation.html" + url.hash;
}
function updateServiceGuidance(service) {
  var free = isFreeSupport(service), phone = replyMethodFromService(service) === "Phone call";
  byID("selectedServiceName").textContent = service.replace(" — Private Message", "").replace(" · $", " · $") || "Choose your support option";
  byID("serviceNote").textContent = free ? "Free support. No payment or explanation is required." : "You won’t pay until I confirm availability.";
  byID("phone").required = phone;
  byID("phone").setCustomValidity("");
  byID("phoneOptional").textContent = phone ? "(required for phone support)" : "(optional)";
  byID("phoneNote").textContent = phone ? "Required for your arranged phone conversation. Include at least 7 digits." : "Optional for private messages. Required for phone calls.";
  byID("paymentFields").hidden = free;
  byID("paymentMethod").disabled = free;
  if (currentStep === 3) renderReview();
}
function setNavigationBusy(busy) {
  document.querySelectorAll('#intakeForm input, #intakeForm select, #intakeForm textarea, #intakeForm button, [data-home]').forEach(function (control) {
    if ("disabled" in control) {
      if (busy) { control.dataset.previousDisabled = String(control.disabled); control.disabled = true; }
      else { control.disabled = control.dataset.previousDisabled === "true"; delete control.dataset.previousDisabled; }
    }
    control.setAttribute("aria-disabled", String(busy));
  });
}
function showStep(index, focus) {
  currentStep = index;
  document.querySelectorAll("[data-pane]").forEach(function (pane) { pane.hidden = Number(pane.dataset.pane) !== index; });
  document.querySelectorAll("[data-step]").forEach(function (button) {
    var n = Number(button.dataset.step);
    if (n === index) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current");
    button.classList.toggle("completed", n < index);
  });
  byID("formContinue").hidden = index === 3;
  byID("sendQuestion").hidden = index !== 3;
  byID("stepCount").textContent = "Step " + (index + 1) + " of 4";
  if (index === 3) renderReview();
  if (focus) {
    var heading = document.querySelector('[data-pane="' + index + '"] h1, [data-pane="' + index + '"] h2');
    heading.focus({ preventScroll: true }); byID("askSection").scrollIntoView({ block: "start", behavior: "smooth" });
  }
}
function emergencyMessage() {
  if (byID("urgency").value === "I may need an emergency vet" || byID("urination").value === "Not urinating" || byID("vomiting").value === "Repeated retching with little or nothing coming up") {
    return "This may be an emergency. Please contact your veterinarian or an emergency hospital now instead of submitting a request. Do not wait here for urgent care.";
  }
  return "";
}
function fileValidationMessage() {
  var files = Array.from(byID("attachments").files || []);
  if (files.length > 4) return "Please choose 4 files or fewer.";
  var oversized = files.find(function (file) { return file.size > 10 * 1024 * 1024; });
  if (oversized) return oversized.name + " is too large. Please keep each file under 10 MB.";
  if (files.reduce(function (sum, file) { return sum + file.size; }, 0) > 40 * 1024 * 1024) return "Please keep the combined files at 40 MB or less.";
  return "";
}
function validateStep(index, showError) {
  var pane = document.querySelector('[data-pane="' + index + '"]');
  if (index === 2) {
    var phone = byID("phone");
    phone.setCustomValidity(phone.required && phone.value.replace(/\D/g, "").length < 7 ? "Please enter a phone number with at least 7 digits." : "");
  }
  var controls = Array.from(pane.querySelectorAll("input, select, textarea"));
  controls.forEach(function (control) {
    if (control.required && (control.type === "text" || control.tagName === "TEXTAREA")) {
      control.setCustomValidity(control.value.trim() ? "" : "Please complete this field.");
    }
  });
  var invalid = controls.find(function (control) { return !control.checkValidity(); });
  if (invalid) {
    if (showError) { showStep(index, false); invalid.reportValidity(); invalid.focus(); }
    return false;
  }
  var message = index === 1 ? emergencyMessage() || fileValidationMessage() : "";
  if (message) { if (showError) { showStep(index, false); showFormNotice(message); } return false; }
  return true;
}
function validateAllSteps() {
  clearFormNotice();
  if (!Object.values(serviceValues).includes(byID("requestedService").value)) {
    byID("serviceChooser").hidden = false; byID("changeService").setAttribute("aria-expanded", "true");
    showFormNotice("Please choose your support option."); return false;
  }
  for (var index = 0; index < 4; index++) if (!validateStep(index, true)) return false;
  return true;
}
function nextStep() {
  if (submissionPending) return;
  clearFormNotice();
  if (validateStep(currentStep, true)) showStep(Math.min(3, currentStep + 1), true);
}
function openIntake(service) {
  if (submissionPending) return;
  if (service) byID("requestedService").value = service;
  if (!byID("requestedService").value) byID("requestedService").value = serviceValues.quick;
  updateServiceGuidance(byID("requestedService").value);
  byID("homeView").hidden = true; byID("askSection").hidden = false;
  document.body.classList.add("intake-open");
  document.querySelector(".home-navigation").hidden = true; document.querySelector(".form-home-link").hidden = false;
  clearFormNotice(); showStep(currentStep, false);
  if (location.hash !== "#askSection") history.replaceState(null, "", "#askSection");
  window.scrollTo({ top: 0, behavior: "instant" });
  var heading = document.querySelector('[data-pane="' + currentStep + '"] h1, [data-pane="' + currentStep + '"] h2');
  heading.focus({ preventScroll: true });
}
function showHome() {
  if (submissionPending) return;
  if (!byID("intakeForm")) { location.assign(location.pathname + location.search); return; }
  byID("homeView").hidden = false; byID("askSection").hidden = true;
  document.body.classList.remove("intake-open");
  document.querySelector(".home-navigation").hidden = false; document.querySelector(".form-home-link").hidden = true;
  history.replaceState(null, "", location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: "instant" });
}
function reviewGroup(title, entries) {
  var section = document.createElement("section"); section.className = "review-group";
  var heading = document.createElement("h3"); heading.textContent = title; section.append(heading);
  var list = document.createElement("dl");
  entries.forEach(function (entry) { var dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = entry[0]; dd.textContent = entry[1] || "Not provided"; list.append(dt, dd); });
  section.append(list); return section;
}
function renderReview() {
  var review = byID("reviewSummary"); review.replaceChildren();
  var value = function (id) { return byID(id).value.trim(); };
  review.append(reviewGroup("Support option", [["Service", value("requestedService")], ["Payment", isFreeSupport(value("requestedService")) ? "No payment required" : "Only after availability approval"]]));
  review.append(reviewGroup("Your pet", [["Name", value("petName")], ["Species", value("species")], ["Age", value("age")], ["Breed", value("breed")], ["Sex", value("sex")], ["Spayed / neutered", value("reproductiveStatus")], ["Weight", value("weight")]]));
  review.append(reviewGroup("Your question", [["Topic", value("category")], ["Question", value("question")], ["Urgency", value("urgency")], ["Started", value("symptomOnset")], ["Changes", value("symptomTrend")], ["Eating", value("appetite")], ["Drinking", value("drinking")], ["Urination", value("urination")], ["Stool", value("stool")], ["Energy", value("energy")], ["Vomiting", value("vomiting")], ["Medical history", value("medicalHistory")], ["Medications", value("currentMedications")], ["Already tried", value("actionsTaken")], ["Files", Array.from(byID("attachments").files || []).map(function (file) { return file.name; }).join(", ") || "None"]]));
  review.append(reviewGroup("Your details", [["Name", value("name")], ["Email", value("email")], ["Phone", value("phone")]]));
}
document.querySelectorAll("[data-service]").forEach(function (button) { button.addEventListener("click", function () { openIntake(serviceValues[button.dataset.service]); }); });
document.querySelectorAll("[data-start]").forEach(function (button) { button.addEventListener("click", function () { openIntake(); }); });
document.querySelectorAll("[data-home]").forEach(function (link) { link.addEventListener("click", function (event) { event.preventDefault(); showHome(); }); });
document.querySelectorAll("[data-questions]").forEach(function (link) { link.addEventListener("click", function (event) { event.preventDefault(); byID("questions").showModal(); }); });
byID("closeQuestions").addEventListener("click", function () { byID("questions").close(); });
byID("formContinue").addEventListener("click", nextStep);
byID("formBack").addEventListener("click", function () { if (submissionPending) return; clearFormNotice(); if (currentStep === 0) showHome(); else showStep(currentStep - 1, true); });
byID("changeService").addEventListener("click", function () { var hidden = !byID("serviceChooser").hidden; byID("serviceChooser").hidden = hidden; byID("changeService").setAttribute("aria-expanded", String(!hidden)); if (!hidden) byID("requestedService").focus(); });
document.querySelectorAll("[data-step]").forEach(function (button) { button.addEventListener("click", function () {
  if (submissionPending) return;
  var target = Number(button.dataset.step); clearFormNotice();
  if (target > currentStep) for (var index = 0; index < target; index++) if (!validateStep(index, true)) return;
  showStep(target, true);
}); });
byID("attachments").addEventListener("change", function () {
  var list = byID("fileList"); list.replaceChildren();
  Array.from(byID("attachments").files || []).forEach(function (file) { var li = document.createElement("li"); li.textContent = file.name + " · " + (file.size / 1048576).toFixed(1) + " MB"; list.append(li); });
  var error = fileValidationMessage(); if (error) showFormNotice(error); else clearFormNotice();
});
byID("phone").addEventListener("input", function () { byID("phone").setCustomValidity(""); });

  // Existing intake relay. Pricing and availability are authoritative on the server.
  var WORKER_URL = "https://vet-helpline-development.dkjmmz6whh.workers.dev";
  var HELPLINE_EMAIL = "info@bayareaapps.com";

  document.getElementById("requestedService").addEventListener("change", function (event) {
    updateServiceGuidance(event.target.value);
  });

  document.getElementById("intakeForm").addEventListener("submit", function (e) {
    e.preventDefault();
    if (submissionPending) return;
    if (currentStep < 3) { nextStep(); return; }
    if (!validateAllSteps()) return;

    var payload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      preferredReply: replyMethodFromService(document.getElementById("requestedService").value),
      requestedService: document.getElementById("requestedService").value,
      petName: document.getElementById("petName").value.trim(),
      species: document.getElementById("species").value,
      age: document.getElementById("age").value.trim() || "Not given",
      breed: document.getElementById("breed").value.trim() || "Not given",
      sex: document.getElementById("sex").value,
      reproductiveStatus: document.getElementById("reproductiveStatus").value,
      weight: document.getElementById("weight").value.trim() || "Not given",
      category: document.getElementById("category").value,
      urgency: document.getElementById("urgency").value,
      symptomOnset: document.getElementById("symptomOnset").value.trim(),
      symptomTrend: document.getElementById("symptomTrend").value,
      appetite: document.getElementById("appetite").value,
      drinking: document.getElementById("drinking").value,
      urination: document.getElementById("urination").value,
      stool: document.getElementById("stool").value,
      energy: document.getElementById("energy").value,
      vomiting: document.getElementById("vomiting").value,
      medicalHistory: document.getElementById("medicalHistory").value.trim() || "None reported",
      currentMedications: document.getElementById("currentMedications").value.trim() || "None reported",
      actionsTaken: document.getElementById("actionsTaken").value.trim() || "None reported",
      question: document.getElementById("question").value.trim(),
      sourceChannel: "Website",
      conversationStatus: "Needs response",
      paymentStatus: isFreeSupport(document.getElementById("requestedService").value) ? "No payment required" : "Awaiting approval",
      paymentMethod: isFreeSupport(document.getElementById("requestedService").value) ? "Free Community Support" : document.getElementById("paymentMethod").value,
      paymentAmount: amountFromService(document.getElementById("requestedService").value),
      paymentLink: "",
      signedConsentName: document.getElementById("signedConsentName").value.trim(),
      signedConsentAt: new Date().toISOString(),
      acceptedTerms: document.getElementById("ack").checked ? "yes" : "no",
      acceptedCommunicationPolicy: document.getElementById("communicationAck").checked ? "yes" : "no",
      website: document.getElementById("website").value // honeypot
    };
    var files = Array.prototype.slice.call(document.getElementById("attachments").files || []);
    payload.attachmentSummary = files.length
      ? files.map(function (file) {
          return file.name + " (" + (file.type || "unknown type") + ", " + Math.ceil(file.size / 1024) + " KB)";
        }).join("\n")
      : "";
    if (payload.website) return; // bots only — humans never see that field

    if (!payload.requestedService) {
      alert("Please choose the kind of help you want first.");
      return;
    }
    if ((payload.preferredReply === "Text message" || payload.preferredReply === "Phone call") && !payload.phone) {
      alert("Please add your phone number for text replies or phone calls.");
      return;
    }
    var moderation = moderateClientMessage(payload.question);
    if (moderation.blocked) {
      alert("This message can't be sent as written because it appears to violate the communication policy. Please revise the message and try again.");
      return;
    }
    if (moderation.warned && !window.confirm("Some wording in this message may come across as directed hostility. Please review it before sending. Send it as written?")) {
      return;
    }
    if (!payload.signedConsentName) {
      alert("Please type your name to sign the consent statement.");
      return;
    }
    if (files.length > 4) {
      alert("Please choose 4 files or fewer.");
      return;
    }
    var oversizedFile = files.find(function (file) { return file.size > 10 * 1024 * 1024; });
    if (oversizedFile) {
      alert(oversizedFile.name + " is too large. Please keep each file under 10 MB.");
      return;
    }
    if (files.reduce(function (total, file) { return total + file.size; }, 0) > 40 * 1024 * 1024) {
      alert("Please keep the combined files at 40 MB or less.");
      return;
    }
    if (payload.urgency === "I may need an emergency vet") {
      alert("Please contact an emergency veterinarian now instead of submitting a paid request.");
      return;
    }
    if (payload.urination === "Not urinating" || payload.vomiting === "Repeated retching with little or nothing coming up") {
      alert("This may be an emergency. Please contact an emergency veterinarian now instead of submitting a paid request.");
      return;
    }

    if (WORKER_URL.indexOf("REPLACE_WITH") === 0) {
      // Email mode: open the client's mail app with the question pre-filled.
      var subject = "Care line question (" + (payload.petName || payload.species) + " · " + payload.category + ")";
      var body = "Name: " + payload.name +
        "\nReply-to email: " + payload.email +
        "\nPreferred reply: " + payload.preferredReply +
        "\nService requested: " + payload.requestedService +
        "\nPayment status: " + payload.paymentStatus +
        "\nPreferred payment: " + payload.paymentMethod +
        "\nPayment amount: " + payload.paymentAmount +
        "\nSigned consent: " + payload.signedConsentName + " at " + payload.signedConsentAt +
        (payload.phone ? "\nPhone: " + payload.phone : "") +
        (payload.petName ? "\nPet name: " + payload.petName : "") +
        "\nPet species: " + payload.species +
        "\nPet age: " + payload.age +
        "\nBreed: " + payload.breed +
        "\nSex: " + payload.sex +
        "\nSpay/neuter status: " + payload.reproductiveStatus +
        "\nWeight: " + payload.weight +
        "\nCategory: " + payload.category +
        "\nUrgency: " + payload.urgency +
        "\nStarted: " + payload.symptomOnset +
        "\nTrend: " + payload.symptomTrend +
        "\nEating: " + payload.appetite +
        "\nDrinking: " + payload.drinking +
        "\nUrination: " + payload.urination +
        "\nStool: " + payload.stool +
        "\nEnergy/behavior: " + payload.energy +
        "\nVomiting: " + payload.vomiting +
        "\nMedical history: " + payload.medicalHistory +
        "\nMedications/supplements: " + payload.currentMedications +
        "\nAlready tried/contacted vet: " + payload.actionsTaken +
        (payload.attachmentSummary ? "\n\nFiles selected:\n" + payload.attachmentSummary + "\n\nPlease attach these files to this email before sending." : "") +
        "\n\nQuestion:\n" + payload.question;
      window.location.href = "mailto:" + HELPLINE_EMAIL +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);
      var note = document.getElementById("mailtoNote");
      if (!note) {
        note = document.createElement("p");
        note.id = "mailtoNote";
        note.className = "note";
        e.target.appendChild(note);
      }
      note.innerHTML = "📧 Your email app should have opened with your question filled in. If you selected files, attach them to that email, then <strong>press send there</strong>. If nothing opened, email it to the public care-line address shown here: <strong>" + HELPLINE_EMAIL + "</strong>.<br><br><strong>Note:</strong> this address should be a public alias that forwards to the operator privately. Email fallback goes to the mailbox only and will not appear in the private operator app until the CloudKit worker or inbound email relay is connected.";
      return;
    }

    var button = e.target.querySelector("button[type=submit]");
    submissionPending = true;
    setNavigationBusy(true);
    button.disabled = true;
    button.textContent = "Sending…";

    var controller = new AbortController();
    // Allow large attachments to upload over a slow mobile connection.
    var uploadBytes = files.reduce(function (total, file) { return total + file.size; }, 0);
    var timeoutMs = Math.max(25000, 30000 + Math.ceil(uploadBytes / (128 * 1024)) * 1000);
    var timeout = window.setTimeout(function () { controller.abort(); }, timeoutMs);
    payload.conversationToken = conversationToken; payload.conversationAccess = conversationAccess;
    fetch(WORKER_URL, {
      method: "POST",
      body: submissionBody(payload, files),
      signal: controller.signal
    }).then(function (response) {
      window.clearTimeout(timeout);
      if (!response.ok) {
        return response.json().catch(function () { return {}; }).then(function (data) {
          throw new Error(data.error || "Send failed");
        });
      }
      return response.json();
    }).then(function (data) {
      if (data.conversationURL) {
        window.location.assign(canonicalConversationURL(data.conversationURL)); return;
      }
      var section = document.getElementById("askSection");
      section.replaceChildren();
      section.classList.add("success-receipt");
      var heading = document.createElement("h2");
      heading.textContent = "✅ Question sent!";
      var message = document.createElement("p");
      message.textContent = isFreeSupport(payload.requestedService)
        ? "Thanks, " + payload.name + ". Your Free Community Support request for " + (payload.petName || "your dog or cat") + " was received. No payment is required."
        : "Thanks, " + payload.name + ". Your " + payload.requestedService + " request for " + (payload.petName || "your dog or cat") + " was received and is waiting for availability approval. You have not been charged. Payment will become available after the operator approves your question.";
      section.append(heading, message);
      if (data.statusURL && isTrustedStatusURL(data.statusURL)) {
        var statusLink = document.createElement("a");
        statusLink.href = data.statusURL;
        statusLink.textContent = "Check approval status";
        statusLink.className = "btn btn-navy";
        section.append(statusLink);
      }
    }).catch(function (error) {
      window.clearTimeout(timeout);
      submissionPending = false;
      setNavigationBusy(false);
      button.disabled = false;
      button.innerHTML = 'Send my question <svg class="icon" aria-hidden="true"><use href="#icon-arrow"/></svg>';
      var fallback = HELPLINE_EMAIL.indexOf("REPLACE_WITH") === 0
        ? "Please try again in a few minutes."
        : "Please try again in a few minutes, or email your question directly to " + HELPLINE_EMAIL + ".";
      showFormNotice("Your question couldn’t be sent. " + (error.message || fallback) + " Your details and files are still here. Please retry.");
    });
  });

  function moderateClientMessage(message) {
    var text = String(message || "").toLowerCase();
    var severe = [
      /\b(i('| a)?m going to|i will|gonna) (kill|hurt|shoot|stab|attack) (you|u)\b/,
      /\bkill yourself\b/,
      /\b(i know where you live|i('| a)?ll find you)\b/,
      /\b(send|show) (me )?(nudes|naked pictures)\b/
    ];
    var directedHostility = [
      /\byou('| a)?re (an? )?(idiot|moron|stupid|useless|worthless)\b/,
      /\bfuck you\b/,
      /\bshut the fuck up\b/
    ];
    return {
      blocked: severe.some(function (pattern) { return pattern.test(text); }),
      warned: directedHostility.some(function (pattern) { return pattern.test(text); })
    };
  }

  function submissionBody(payload, files) {
    var form = new FormData();
    Object.keys(payload).forEach(function (key) {
      form.append(key, payload[key]);
    });
    files.forEach(function (file) {
      form.append("attachments", file, file.name);
    });
    return form;
  }

  function amountFromService(service) {
    if (isFreeSupport(service)) return "Free";
    var match = String(service).match(/\$\d+/);
    return match ? match[0] : "Confirm";
  }

  function isFreeSupport(service) { return String(service).indexOf("Free Community Support") === 0; }

  var conversationToken = crypto.randomUUID().replaceAll("-", "");
  var conversationAccess = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

  function replyMethodFromService(service) {
    if (service.toLowerCase().indexOf("text") !== -1) return "Text message";
    if (service.indexOf("Phone") === 0) return "Phone call";
    return service.indexOf("Private Message") !== -1 ? "Private website conversation" : "Email";
  }

  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js");
  }

byID("requestedService").value = serviceValues.quick;
updateServiceGuidance(serviceValues.quick);
if (location.hash === "#askSection") openIntake();
if (location.hash === "#questions") byID("questions").showModal();
window.addEventListener("hashchange", function () {
  if (location.hash === "#askSection") openIntake();
  if (location.hash === "#questions") byID("questions").showModal();
});

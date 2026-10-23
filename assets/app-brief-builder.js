/* Local planning tool: no requests, storage, analytics, or advertising. */
(function () {
  'use strict';
  const form = document.querySelector('#brief-builder');
  if (!form) return;
  const result = document.querySelector('#brief-result');
  const output = document.querySelector('#brief-output');
  const status = document.querySelector('#brief-status');
  const fields = ['audience', 'task', 'problem', 'essential', 'later', 'access', 'success', 'budget', 'timing'];
  const questions = {
    problem: 'What is difficult about the current process?',
    essential: 'Which steps must work in the first version?',
    access: 'Who can see or change information, and when would payment happen?',
    success: 'What result will show that the main task works?',
    budget: 'What budget range can be discussed?',
    timing: 'Is there a preferred date or a fixed deadline?'
  };
  let revision = 0;
  const value = name => form.elements[name].value.trim();
  const list = text => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => '- ' + line).join('\n');
  form.hidden = false;
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    for (const name of ['audience', 'task']) {
      if (!value(name)) {
        form.elements[name].value = '';
        form.elements[name].reportValidity();
        return;
      }
    }
    revision++;
    const answers = Object.fromEntries(fields.map(name => [name, value(name)]));
    const openQuestions = Object.entries(questions).filter(([name]) => !answers[name]).map(([, question]) => '- ' + question);
    output.value = [
      'FIRST APP BRIEF — PLANNING DRAFT',
      'Prepared with the Bay Area Apps brief builder. This is not a quote or an agreed scope.',
      'AUDIENCE\n' + answers.audience,
      'MAIN TASK\n' + answers.task,
      'CURRENT PROBLEM\n' + (answers.problem || 'To discuss.'),
      'ESSENTIAL FIRST-VERSION STEPS\n' + (list(answers.essential) || 'To discuss.'),
      'IDEAS THAT CAN WAIT\n' + (list(answers.later) || 'No later ideas listed yet.'),
      'ACCESS, INFORMATION AND PAYMENTS\n' + (answers.access || 'To discuss.'),
      'SUCCESS CHECK\n' + (answers.success || 'To discuss.'),
      'BUDGET RANGE\n' + (answers.budget || 'Not sure yet.'),
      'PREFERRED TIMING\n' + (answers.timing || 'To discuss.'),
      'OPEN QUESTIONS\n' + (openQuestions.join('\n') || 'Review these answers with a developer and confirm assumptions.'),
      'BEFORE AGREEING TO WORK\nConfirm deliverables, who supplies content, account ownership, review milestones, support, and how changes affect price and timing.'
    ].join('\n\n');
    status.textContent = '';
    result.hidden = false;
    result.focus();
  });
  form.addEventListener('reset', () => {
    revision++;
    output.value = '';
    status.textContent = '';
    result.hidden = true;
  });
  document.querySelector('#copy-brief').addEventListener('click', async () => {
    if (!output.value) return;
    const copiedRevision = revision;
    try {
      await navigator.clipboard.writeText(output.value);
      if (copiedRevision === revision) status.textContent = 'Draft copied. Review it before sharing.';
    } catch (_) {
      if (copiedRevision !== revision) return;
      output.focus();
      output.select();
      status.textContent = 'Your browser could not copy automatically. The draft is selected; use your device’s Copy action or download the text file.';
    }
  });
  document.querySelector('#download-brief').addEventListener('click', () => {
    if (!output.value) return;
    try {
      const url = URL.createObjectURL(new Blob([output.value + '\n'], {type: 'text/plain;charset=utf-8'}));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'my-app-brief.txt';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Text file requested. Check your browser’s downloads.';
    } catch (_) {
      status.textContent = 'This browser could not download a file. Use Copy draft or select the draft text to save it.';
    }
  });
})();

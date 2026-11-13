(function () {
  'use strict';
  var form = document.getElementById('project-form');
  if (!form) return;
  var status = document.getElementById('form-status');
  var button = form.querySelector('button[type="submit"]');
  var widget = null, busy = false, token = '';
  function show(title, text, focus) {
    status.hidden = false;
    status.querySelector('strong').textContent = title;
    status.querySelector('p').textContent = text;
    if (focus) status.focus();
  }
  function validate(field) {
    var input = field.querySelector('input, select, textarea');
    if (!input) return true;
    var ok = input.checkValidity() && (!input.required || input.value.trim().length > 0);
    field.classList.toggle('is-invalid', !ok);
    input.setAttribute('aria-invalid', String(!ok));
    var error = field.querySelector('.err');
    if (error) error.textContent = ok ? '' : (input.getAttribute('data-err') || 'Please check this field.');
    return ok;
  }
  var fields = Array.prototype.slice.call(form.querySelectorAll('.field'));
  fields.forEach(function (field) {
    field.querySelector('input, select, textarea').addEventListener('blur', function () { validate(field); });
  });
  function resetChallenge() {
    token = ''; button.disabled = true;
    if (widget !== null && window.turnstile) window.turnstile.reset(widget);
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (busy) return;
    var first = null;
    fields.forEach(function (field) { if (!validate(field) && !first) first = field; });
    if (first) { first.querySelector('input, select, textarea').focus(); return; }
    if (!token) { show('Please complete the spam check.', 'If it does not load, call (877) 266-7379.', true); return; }
    busy = true; button.disabled = true; form.setAttribute('aria-busy', 'true');
    var data = new FormData(form);
    data.set('cf-turnstile-response', token);
    var controller = new AbortController();
    var timeout = window.setTimeout(function () { controller.abort(); }, 25000);
    show('Sending your request…', 'Please keep this page open.', false);
    fetch('/api/contact', { method: 'POST', body: data, headers: { Accept: 'application/json' }, signal: controller.signal, credentials: 'same-origin' })
      .then(function (response) {
        return response.json().then(function (result) {
          if (!response.ok || result.ok !== true) throw new Error(result.error || 'Please try again or call (877) 266-7379.');
          form.reset();
          show('Thanks. Your request has been sent.', 'We will respond using the contact details you provided. For urgent service, call (877) 266-7379.', true);
        });
      })
      .catch(function (error) {
        var message = error.name === 'AbortError' ? 'We could not confirm whether it was sent. Please call (877) 266-7379 before sending again.' : (error.name === 'SyntaxError' || error.name === 'TypeError' ? 'Please try again or call (877) 266-7379.' : error.message);
        show('We could not confirm your request.', message, true);
      })
      .finally(function () {
        window.clearTimeout(timeout); busy = false; form.removeAttribute('aria-busy'); resetChallenge();
      });
  });
  fetch('/api/contact/config', { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
    .then(function (response) { if (!response.ok) throw new Error(); return response.json(); })
    .then(function (config) {
      if (!config.enabled || !config.siteKey) throw new Error();
      var script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = function () {
        try {
          widget = window.turnstile.render('#spam-check', {
            sitekey: config.siteKey, action: 'contact',
            callback: function (value) { token = value; button.disabled = busy || !token; },
            'expired-callback': function () { token = ''; button.disabled = true; },
            'error-callback': function () {
              token = ''; button.disabled = true;
              show('Spam protection could not load.', 'Please refresh this page or call (877) 266-7379.', false);
            }
          });
        } catch (_) { script.onerror(); }
      };
      script.onerror = function () { show('Spam protection could not load.', 'Please refresh this page or call (877) 266-7379.', false); };
      document.head.appendChild(script);
    })
    .catch(function () {
      show('Please call to discuss your project.', 'Online requests are currently unavailable. Call (877) 266-7379 and we will take your details.', false);
    });
})();

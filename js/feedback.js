/* MindGrid in-game feedback form. Messages go straight to the MZA Games inbox through the studio's
 * feedback relay (a Google Apps Script web app that e-mails mzagames@proton.me). No mail app opens and
 * no password or API secret is in the game: the relay URL below is public.
 * The draft is kept on this device until it is sent, so going offline never loses the text. */
(function () {
  'use strict';
  var MG = window.MG;
  var FB = MG.FEEDBACK = {
    url: 'https://script.google.com/macros/s/AKfycbzwXApSclS9-ptrVh6jQR6m0Lf6WCLz-eT_RN_tSfOfDHwhoaWjkdkDNsM7wVGT-cUt/exec', // the deployed relay web app URL (https://script.google.com/macros/s/…/exec)
    key: 'mza-feedback-v1', // not a secret: it only filters random bots
    categories: ['Bug', 'Idea', 'Levels', 'Ads & purchases', 'Other'],
    max: 2000
  };
  var DRAFT = 'mindgrid.feedback';

  FB.emailOk = function (e) {
    e = (e || '').trim();
    return !e || (e.length <= 120 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(e));
  };
  FB.body = function (category, message, email, device) {
    return JSON.stringify({ key: FB.key, app: 'MindGrid', version: MG.VERSION, category: FB.categories.indexOf(category) >= 0 ? category : 'Other',
      message: String(message || '').trim(), email: String(email || '').trim(), device: device || '', website: '' });
  };
  FB.device = function () {
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    var android = /Android ([\d.]+)/.exec(ua);
    var native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
    return (native ? 'Android app' : 'Web') + (android ? ' · Android ' + android[1] : '');
  };
  FB.explain = function (result) {
    if (result === 'offline') return 'You seem to be offline. Your message is kept. Connect to the internet and tap Try again.';
    if (result === 'not_configured') return 'Feedback can\'t be sent from this version yet. Your message is kept.';
    return 'Couldn\'t send right now. Your message is kept. Please tap Try again in a minute.';
  };
  /** Resolves 'sent' | 'offline' | 'failed' | 'not_configured'. text/plain avoids a CORS preflight;
   * Apps Script redirects to its JSON reply, which fetch follows. */
  FB.send = function (body, fetchFn) {
    fetchFn = fetchFn || (typeof fetch !== 'undefined' ? fetch : null);
    if (!/^https:\/\//.test(FB.url) || !fetchFn) return Promise.resolve('not_configured');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve('offline');
    var timer, timeout = new Promise(function (resolve) { timer = setTimeout(function () { resolve('offline'); }, 15000); });
    var request = fetchFn(FB.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow' })
      .then(function (res) { return res.ok ? res.text() : ''; })
      .then(function (text) { try { return JSON.parse(text).ok === true ? 'sent' : 'failed'; } catch (e) { return 'failed'; } },
        function () { return 'offline'; }); // network error (no connection, DNS or timeout)
    return Promise.race([request, timeout]).then(function (r) { clearTimeout(timer); return r; });
  };

  function load() { try { return JSON.parse(localStorage.getItem(DRAFT) || '{}'); } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) { /* ignore */ } }

  /** Opens the form as a pop-up. */
  FB.open = function () {
    var d = load(), cat = FB.categories.indexOf(d.category) >= 0 ? d.category : 'Bug', sent = false, sending = false;
    var m = MG.modal('<h3>Send feedback</h3><p class="muted">Found a bug or have an idea? Your note goes straight to the MZA Games team. No e-mail app needed.</p>' +
      '<div class="fb-cats" role="group" aria-label="What is it about?">' + FB.categories.map(function (c) {
        return '<button type="button" class="chip fb-cat" data-c="' + MG.esc(c) + '" aria-pressed="false">' + MG.esc(c) + '</button>'; }).join('') + '</div>' +
      '<textarea class="fb-msg" rows="5" maxlength="' + FB.max + '" placeholder="Tell us what happened or what you\'d like…" aria-label="Your message"></textarea>' +
      '<div class="fb-count muted"></div>' +
      '<label class="fb-lbl" for="fbMail">Your e-mail (optional, only if you\'d like a reply)</label>' +
      '<input id="fbMail" class="fb-mail" type="email" inputmode="email" autocomplete="email" placeholder="name@example.com">' +
      '<p class="fb-status" role="status" hidden></p>' +
      '<button type="button" class="btn" data-act="send">Send</button>' +
      '<button type="button" class="btn ghost" data-act="close">Close</button>' +
      '<p class="fb-note muted">We get your message, the category, the game version and whether you play on the web or the Android app, plus your e-mail if you add one.</p>',
      { cls: 'fb-modal', dismissable: true });
    var el = m.el, msg = el.querySelector('.fb-msg'), mail = el.querySelector('.fb-mail'), status = el.querySelector('.fb-status'),
      sendBtn = el.querySelector('[data-act=send]'), count = el.querySelector('.fb-count');
    msg.value = d.message || ''; mail.value = d.email || '';
    function cats() { el.querySelectorAll('.fb-cat').forEach(function (b) { var on = b.dataset.c === cat; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); }
    function keep() { if (!sent) save({ category: cat, message: msg.value, email: mail.value }); count.textContent = msg.value.length + ' / ' + FB.max; }
    function show(text, ok) { status.textContent = text; status.className = 'fb-status ' + (ok ? 'ok' : 'bad'); status.hidden = false; }
    el.querySelectorAll('.fb-cat').forEach(function (b) { b.addEventListener('click', function () { cat = b.dataset.c; cats(); keep(); }); });
    msg.addEventListener('input', function () { keep(); if (!sending) status.hidden = true; });
    mail.addEventListener('input', function () { keep(); if (!sending) status.hidden = true; });
    el.querySelector('[data-act=close]').addEventListener('click', m.close);
    sendBtn.addEventListener('click', function () {
      if (sent) { m.close(); return; }
      if (sending) return;
      var text = msg.value.trim();
      if (text.length < 3) { show('Please write a few words first.'); msg.focus(); return; }
      if (!FB.emailOk(mail.value)) { show('That e-mail doesn\'t look right. Fix it or leave the box empty.'); mail.focus(); return; }
      sending = true; sendBtn.disabled = true; sendBtn.textContent = 'Sending…'; status.hidden = true;
      FB.send(FB.body(cat, text, mail.value, FB.device())).then(function (result) {
        sending = false; sendBtn.disabled = false;
        if (result === 'sent') {
          sent = true; try { localStorage.removeItem(DRAFT); } catch (e) { /* ignore */ }
          msg.disabled = true; mail.disabled = true; sendBtn.textContent = 'Done';
          show('Thank you! Your message was sent to the MZA Games team.', true);
        } else { sendBtn.textContent = 'Try again'; show(FB.explain(result)); }
      });
    });
    cats(); keep();
    return m;
  };
})();

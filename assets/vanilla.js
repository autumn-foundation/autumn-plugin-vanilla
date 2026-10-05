(function () {
  // autumn-plugin-vanilla runtime.
  //
  // Binds behaviors to elements that have `data-vanilla="<name> …"`.
  // Scans on DOMContentLoaded and on each `htmx:load`. Runs cleanup on each
  // `htmx:beforeCleanupElement`. Works under CSP `script-src 'self'`:
  // no eval, no inline handlers, no HTML strings.
  //
  // Public API: window.Vanilla.register(name, init), scan(root),
  // teardown(root), names(). `init(el)` can return a cleanup function.
  'use strict';

  if (window.Vanilla) return;

  var NAME = /^[a-z][a-z0-9-]*$/;
  // The largest delay that setTimeout accepts.
  var TIMER_MAX = 2147483647;

  var behaviors = Object.create(null);
  // Element → Map(behavior name → cleanup function or null).
  var bound = new WeakMap();
  var ready = false;

  // ── Runtime ────────────────────────────────────────────────────────────

  function namesOf(el) {
    return (el.getAttribute('data-vanilla') || '').split(/\s+/).filter(Boolean);
  }

  // Calls fn for root (when it has data-vanilla) and each match inside it.
  function each(root, fn) {
    if (!root || typeof root.querySelectorAll !== 'function') return;
    if (root.nodeType === 1 && root.hasAttribute('data-vanilla')) fn(root);
    var list = root.querySelectorAll('[data-vanilla]');
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function bind(el, name) {
    var init = behaviors[name];
    if (!init) return;
    var done = bound.get(el);
    if (!done) {
      done = new Map();
      bound.set(el, done);
    }
    if (done.has(name)) return;
    // Mark first: a failed init is not tried again on each scan.
    done.set(name, null);
    try {
      var cleanup = init(el);
      if (typeof cleanup === 'function') done.set(name, cleanup);
    } catch (err) {
      console.error('vanilla: behavior "' + name + '" failed:', err);
    }
  }

  function scan(root) {
    each(root === undefined ? document : root, function (el) {
      namesOf(el).forEach(function (name) { bind(el, name); });
    });
  }

  function teardown(root) {
    each(root, function (el) {
      var done = bound.get(el);
      if (!done) return;
      bound.delete(el);
      done.forEach(function (cleanup, name) {
        if (!cleanup) return;
        try {
          cleanup();
        } catch (err) {
          console.error('vanilla: cleanup of "' + name + '" failed:', err);
        }
      });
    });
  }

  function register(name, init) {
    if (typeof name !== 'string' || !NAME.test(name)) {
      throw new TypeError('vanilla: invalid behavior name: ' + String(name));
    }
    if (typeof init !== 'function') {
      throw new TypeError('vanilla: init of "' + name + '" is not a function');
    }
    if (behaviors[name]) throw new Error('vanilla: behavior already registered: ' + name);
    behaviors[name] = init;
    // A late registration binds the elements already in the page.
    if (ready) scan(document);
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  function opt(el, name) {
    return el.getAttribute('data-vanilla-' + name);
  }

  // Runs a document query. An empty or invalid selector gives fallback.
  function select(method, selector, fallback) {
    if (!selector) return fallback;
    try {
      return document[method](selector);
    } catch (err) {
      return fallback;
    }
  }

  function query(selector) {
    return select('querySelector', selector, null);
  }

  function queryAll(selector) {
    return Array.prototype.slice.call(select('querySelectorAll', selector, []));
  }

  // A non-negative integer attribute in milliseconds, or 0.
  function millis(value) {
    if (value === null || !/^\d+$/.test(value)) return 0;
    return Math.min(parseInt(value, 10), TIMER_MAX);
  }

  // Adds a listener. Returns the function that removes it.
  function on(el, type, fn, capture) {
    el.addEventListener(type, fn, !!capture);
    return function () { el.removeEventListener(type, fn, !!capture); };
  }

  function all(offs) {
    return function () { offs.forEach(function (off) { off(); }); };
  }

  // Sends a bubbling event. Returns false when a listener cancels it.
  function emit(el, type, detail, cancelable) {
    return el.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      cancelable: !!cancelable,
      detail: detail || null,
    }));
  }

  // The closest ancestor (or self) of the event target that matches.
  // Returns null when that element is outside el.
  function closestIn(el, event, selector) {
    var target = event.target;
    var found = target && target.closest ? target.closest(selector) : null;
    return found && el.contains(found) ? found : null;
  }

  // ── copy ───────────────────────────────────────────────────────────────

  function legacyCopy(text) {
    var field = document.createElement('textarea');
    var active = document.activeElement;
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.top = '0';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    field.remove();
    if (active && typeof active.focus === 'function') active.focus();
    return ok;
  }

  function writeClipboard(text) {
    var legacy = function () {
      return legacyCopy(text) ? Promise.resolve() : Promise.reject(new Error('copy failed'));
    };
    var api = navigator.clipboard;
    if (api && typeof api.writeText === 'function') return api.writeText(text).catch(legacy);
    return legacy();
  }

  register('copy', function (el) {
    var timer = 0;

    function source() {
      var text = opt(el, 'copy-text');
      if (text !== null) return text;
      var target = query(opt(el, 'copy'));
      if (!target) return null;
      return target.matches('input, textarea, select') ? target.value : target.textContent;
    }

    function settle(ok, text) {
      el.setAttribute('data-vanilla-state', ok ? 'copied' : 'failed');
      clearTimeout(timer);
      timer = setTimeout(function () { el.removeAttribute('data-vanilla-state'); }, 2000);
      emit(el, ok ? 'vanilla:copied' : 'vanilla:copy-failed', { text: text });
    }

    var off = on(el, 'click', function () {
      var text = source();
      if (text === null) return;
      writeClipboard(text).then(
        function () { settle(true, text); },
        function () { settle(false, text); }
      );
    });
    return function () {
      off();
      clearTimeout(timer);
    };
  });

  // ── toggle ─────────────────────────────────────────────────────────────

  register('toggle', function (el) {
    var cls = (opt(el, 'toggle-class') || '').trim();

    function isOpen(target) {
      return cls ? target.classList.contains(cls) : !target.hidden;
    }

    function setOpen(target, open) {
      if (!cls) {
        target.hidden = !open;
        return;
      }
      try {
        target.classList.toggle(cls, open);
      } catch (err) {
        // An invalid class name (for example, one with a space).
      }
    }

    function sync(targets) {
      if (targets.length) el.setAttribute('aria-expanded', String(isOpen(targets[0])));
    }

    sync(queryAll(opt(el, 'toggle')));
    return on(el, 'click', function () {
      var targets = queryAll(opt(el, 'toggle'));
      if (!targets.length) return;
      var open = !isOpen(targets[0]);
      targets.forEach(function (target) { setOpen(target, open); });
      sync(targets);
    });
  });

  // ── dismiss ────────────────────────────────────────────────────────────

  register('dismiss', function (el) {
    var delay = millis(opt(el, 'dismiss-after'));
    var timer = 0;
    var hover = false;
    var focus = false;

    function close() {
      if (!emit(el, 'vanilla:dismiss', null, true)) return;
      teardown(el);
      el.remove();
    }

    function stop() {
      clearTimeout(timer);
      timer = 0;
    }

    // Pauses while the pointer or focus is inside (WCAG 2.2.1).
    function start() {
      stop();
      if (delay > 0 && !hover && !focus) timer = setTimeout(close, delay);
    }

    var off = all([
      on(el, 'click', function (event) {
        var control = closestIn(el, event, '[data-vanilla-dismiss-close]');
        // A close control belongs to its nearest dismiss element only.
        if (control && control.closest('[data-vanilla~="dismiss"]') === el) close();
      }),
      on(el, 'mouseenter', function () { hover = true; stop(); }),
      on(el, 'mouseleave', function () { hover = false; start(); }),
      on(el, 'focusin', function () { focus = true; stop(); }),
      on(el, 'focusout', function (event) {
        if (el.contains(event.relatedTarget)) return;
        focus = false;
        start();
      }),
    ]);
    start();
    return function () {
      stop();
      off();
    };
  });

  // ── confirm ────────────────────────────────────────────────────────────

  register('confirm', function (el) {
    function ask(event) {
      if (window.confirm(opt(el, 'confirm') || 'Are you sure?')) return;
      event.preventDefault();
      // Capture phase: this stops htmx and other handlers on the target.
      event.stopImmediatePropagation();
    }

    return all([
      on(el, 'submit', ask, true),
      on(el, 'click', function (event) {
        if (closestIn(el, event, 'a[href]')) ask(event);
      }, true),
    ]);
  });

  // ── autosubmit ─────────────────────────────────────────────────────────

  register('autosubmit', function (el) {
    var types = (opt(el, 'autosubmit-on') || 'change').split(/\s+/).filter(function (type) {
      return type === 'change' || type === 'input';
    });
    var delay = millis(opt(el, 'autosubmit-delay'));
    var timer = 0;

    function submit(form) {
      // requestSubmit sends a submit event, so htmx and validation run.
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else form.submit();
    }

    function handle(event) {
      var form = (event.target && event.target.form) || el.closest('form');
      if (!form) return;
      clearTimeout(timer);
      if (delay > 0) timer = setTimeout(function () { submit(form); }, delay);
      else submit(form);
    }

    var off = all(types.map(function (type) { return on(el, type, handle); }));
    return function () {
      clearTimeout(timer);
      off();
    };
  });

  // ── count ──────────────────────────────────────────────────────────────

  register('count', function (el) {
    var field = el.matches('input, textarea') ? el : el.querySelector('input, textarea');
    var selector = opt(el, 'count');
    var output = selector !== null ? query(selector) : el.querySelector('[data-vanilla-count-output]');
    if (!field || !output) return;
    var remaining = opt(el, 'count-mode') === 'remaining';

    function update() {
      // UTF-16 code units, the same unit as maxlength.
      var used = field.value.length;
      var max = field.maxLength;
      if (max < 0) output.textContent = String(used);
      else if (remaining) output.textContent = String(Math.max(0, max - used));
      else output.textContent = used + '/' + max;
    }

    update();
    var offs = [on(field, 'input', update)];
    // A reset changes the value after the event. Update one task later.
    if (field.form) offs.push(on(field.form, 'reset', function () { setTimeout(update, 0); }));
    return all(offs);
  });

  // ── local-time ─────────────────────────────────────────────────────────

  var STYLES = Object.create(null);
  STYLES.datetime = { dateStyle: 'medium', timeStyle: 'short' };
  STYLES.date = { dateStyle: 'medium' };
  STYLES.time = { timeStyle: 'short' };

  var UNITS = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
    ['second', 1],
  ];

  function relative(date, locale) {
    var seconds = Math.round((date.getTime() - Date.now()) / 1000);
    var abs = Math.abs(seconds);
    var format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (var i = 0; i < UNITS.length; i++) {
      if (abs >= UNITS[i][1] || i === UNITS.length - 1) {
        return format.format(Math.round(seconds / UNITS[i][1]), UNITS[i][0]);
      }
    }
    return '';
  }

  function formatTime(date, format, locale) {
    if (format === 'relative') return relative(date, locale);
    return new Intl.DateTimeFormat(locale, STYLES[format] || STYLES.datetime).format(date);
  }

  function renderTime(time, format) {
    var date = new Date(time.getAttribute('datetime'));
    if (isNaN(date.getTime())) return;
    var holder = time.closest('[lang]');
    var locale = (holder && holder.getAttribute('lang')) || undefined;
    var text;
    try {
      text = formatTime(date, format, locale);
    } catch (err) {
      // An invalid lang tag. Use the browser locale.
      text = formatTime(date, format, undefined);
    }
    if (!time.hasAttribute('title')) time.setAttribute('title', time.textContent.trim());
    time.textContent = text;
  }

  register('local-time', function (el) {
    var format = opt(el, 'local-time');
    if (el.matches('time[datetime]')) renderTime(el, format);
    el.querySelectorAll('time[datetime]').forEach(function (time) { renderTime(time, format); });
  });

  // ── Start ──────────────────────────────────────────────────────────────

  window.Vanilla = Object.freeze({
    register: register,
    scan: scan,
    teardown: teardown,
    names: function () { return Object.keys(behaviors).sort(); },
  });

  document.addEventListener('htmx:load', function (event) {
    scan((event.detail && event.detail.elt) || event.target);
  });
  document.addEventListener('htmx:beforeCleanupElement', function (event) {
    teardown((event.detail && event.detail.elt) || event.target);
  });

  function start() {
    ready = true;
    scan(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

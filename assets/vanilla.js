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
  // Elements inside `[data-vanilla-ignore]` do not bind.
  'use strict';

  // A symbol key: page markup (`id="Vanilla"`) cannot set it.
  var KEY = Symbol.for('autumn-plugin-vanilla');
  if (window[KEY]) return;

  var NAME = /^[a-z][a-z0-9-]*$/;
  // The largest delay that setTimeout accepts.
  var TIMER_MAX = 2147483647;
  // Prototype methods: page markup (`name="querySelector"`) cannot replace them.
  var docQuery = Document.prototype.querySelector;
  var docQueryAll = Document.prototype.querySelectorAll;
  var elQueryAll = Element.prototype.querySelectorAll;
  var fragQueryAll = DocumentFragment.prototype.querySelectorAll;

  var behaviors = Object.create(null);
  // Element → Map(behavior name → cleanup function or null).
  var bound = new WeakMap();
  var ready = false;

  // ── Runtime ────────────────────────────────────────────────────────────

  function namesOf(el) {
    return (el.getAttribute('data-vanilla') || '').split(/\s+/).filter(Boolean);
  }

  function queryAllIn(root, selector) {
    if (root.nodeType === 9) return docQueryAll.call(root, selector);
    if (root.nodeType === 11) return fragQueryAll.call(root, selector);
    return elQueryAll.call(root, selector);
  }

  function isNode(root) {
    return !!root && (root.nodeType === 1 || root.nodeType === 9 || root.nodeType === 11);
  }

  // Calls fn for root and each element inside it that matches selector.
  function each(root, selector, fn) {
    if (!isNode(root)) return;
    if (root.nodeType === 1 && root.matches(selector)) fn(root);
    var list = queryAllIn(root, selector);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  function ignored(el) {
    return !!el.closest('[data-vanilla-ignore]');
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
    // Mark first. The runtime does not try a failed init again on each scan.
    done.set(name, null);
    try {
      var cleanup = init(el);
      if (typeof cleanup === 'function') done.set(name, cleanup);
    } catch (err) {
      console.error('vanilla: behavior "' + name + '" failed:', err);
    }
  }

  function bindAll(el) {
    if (ignored(el)) return;
    namesOf(el).forEach(function (name) { bind(el, name); });
  }

  // Runs the cleanups of one element. Works when `data-vanilla` is gone.
  function release(el) {
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
  }

  function scan(root) {
    each(root === undefined ? document : root, '[data-vanilla]', bindAll);
  }

  // Runs the cleanups of root and each element inside it.
  function teardown(root) {
    each(root, '*', release);
  }

  // Binds an element again: cleanup, then init. Used after a swap inside it.
  function rebind(el) {
    if (!bound.has(el)) return;
    release(el);
    bindAll(el);
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

  // The first match of a selector in the document. An empty or invalid
  // selector gives null.
  function query(selector) {
    if (!selector) return null;
    try {
      return docQuery.call(document, selector);
    } catch (err) {
      return null;
    }
  }

  function queryAll(selector) {
    if (!selector) return [];
    try {
      return Array.prototype.slice.call(docQueryAll.call(document, selector));
    } catch (err) {
      return [];
    }
  }

  // A non-negative integer attribute in milliseconds, or 0.
  function millis(value) {
    if (value === null || !/^\d+$/.test(value)) return 0;
    return Math.min(parseInt(value, 10), TIMER_MAX);
  }

  // Adds a listener. Returns the function that removes it.
  function on(target, type, fn, capture) {
    target.addEventListener(type, fn, !!capture);
    return function () { target.removeEventListener(type, fn, !!capture); };
  }

  function all(offs) {
    return function () { offs.forEach(function (off) { off(); }); };
  }

  // Sends a bubbling event. Returns false when a listener cancels it.
  function emit(el, type, cancelable) {
    return el.dispatchEvent(new CustomEvent(type, { bubbles: true, cancelable: !!cancelable }));
  }

  // The closest ancestor (or self) of the event target that matches.
  // Returns null when that element is outside el.
  function closestIn(el, event, selector) {
    var target = event.target;
    var found = target && target.closest ? target.closest(selector) : null;
    return found && el.contains(found) ? found : null;
  }

  // True when el is the nearest element with this behavior around node.
  function owns(el, node, name) {
    return !!node && node.closest('[data-vanilla~="' + name + '"]') === el;
  }

  // One shared, visually hidden status region for announcements.
  var live = null;

  function liveRegion() {
    if (live && live.isConnected) return live;
    live = document.createElement('div');
    live.setAttribute('role', 'status');
    live.setAttribute('data-vanilla-live', '');
    // CSSOM styles are allowed under a strict style-src.
    var s = live.style;
    s.position = 'absolute';
    s.width = '1px';
    s.height = '1px';
    s.overflow = 'hidden';
    s.clip = 'rect(0 0 0 0)';
    s.whiteSpace = 'nowrap';
    document.body.appendChild(live);
    return live;
  }

  function announce(text) {
    liveRegion().textContent = text;
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
    var dead = false;

    function source() {
      var text = opt(el, 'copy-text');
      if (text !== null) return text;
      var target = query(opt(el, 'copy'));
      // Never copy secrets: password and hidden fields are refused.
      if (!target || target.matches('input[type=password], input[type=hidden]')) return null;
      return target.matches('input, textarea, select') ? target.value : target.textContent;
    }

    function settle(ok) {
      if (dead) return;
      el.setAttribute('data-vanilla-state', ok ? 'copied' : 'failed');
      announce(ok ? opt(el, 'copy-done') || 'Copied' : opt(el, 'copy-failed') || 'Copy failed');
      clearTimeout(timer);
      timer = setTimeout(function () {
        el.removeAttribute('data-vanilla-state');
        announce('');
      }, 2000);
      emit(el, ok ? 'vanilla:copied' : 'vanilla:copy-failed');
    }

    var off = on(el, 'click', function () {
      var text = source();
      if (text === null) return;
      writeClipboard(text).then(
        function () { settle(true); },
        function () { settle(false); }
      );
    });
    return function () {
      dead = true;
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

  // Where focus goes when a dismissed element held it.
  function focusAfter(el) {
    var target = query(opt(el, 'dismiss-focus')) ||
      el.nextElementSibling || el.previousElementSibling || el.parentElement;
    if (!target || el.contains(target)) return;
    if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }

  register('dismiss', function (el) {
    var delay = millis(opt(el, 'dismiss-after'));
    var timer = 0;
    // The pointer or focus can already be inside at bind time.
    var hover = el.matches(':hover');
    var focus = el.contains(document.activeElement);

    function close() {
      if (!emit(el, 'vanilla:dismiss', true)) return;
      var hadFocus = el.contains(document.activeElement);
      if (hadFocus) focusAfter(el);
      teardown(el);
      el.remove();
    }

    function stop() {
      clearTimeout(timer);
      timer = 0;
    }

    // The timer pauses while the pointer or focus is inside.
    function start() {
      stop();
      if (delay > 0 && !hover && !focus) timer = setTimeout(close, delay);
    }

    var off = all([
      on(el, 'click', function (event) {
        var control = closestIn(el, event, '[data-vanilla-dismiss-close]');
        // A close control belongs to its nearest dismiss element only.
        if (owns(el, control, 'dismiss')) close();
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

  // Clicks that send a request: links and htmx elements that are not forms.
  var CLICK_ACTION = 'a[href], [hx-get], [hx-post], [hx-put], [hx-patch], [hx-delete]';

  register('confirm', function (el) {
    function ask(event) {
      if (window.confirm(opt(el, 'confirm') || 'Are you sure?')) return;
      event.preventDefault();
      // Capture phase: this stops htmx and other handlers on the target.
      event.stopImmediatePropagation();
    }

    return all([
      on(el, 'submit', function (event) {
        // A nested confirm asks for its own forms.
        if (owns(el, event.target, 'confirm')) ask(event);
      }, true),
      on(el, 'click', function (event) {
        var action = closestIn(el, event, CLICK_ACTION);
        // A form asks on submit, not on click.
        if (action && action.tagName !== 'FORM' && owns(el, action, 'confirm')) ask(event);
      }, true),
    ]);
  });

  // ── autosubmit ─────────────────────────────────────────────────────────

  // Text fields send `change` on blur and on Enter. Enter also submits, so
  // a `change` from a text field would submit two times.
  var TEXT_FIELD = 'textarea, input:not([type]), input[type=text], input[type=search], ' +
    'input[type=email], input[type=url], input[type=tel], input[type=password], input[type=number]';

  register('autosubmit', function (el) {
    var types = (opt(el, 'autosubmit-on') || 'change').split(/\s+/).filter(function (type) {
      return type === 'change' || type === 'input';
    });
    var delay = millis(opt(el, 'autosubmit-delay'));
    var timer = 0;
    var pending = null;

    function submit(form) {
      pending = null;
      // An invalid form does not submit. The user is still typing, so the
      // runtime does not move focus to show the error.
      if (!form.checkValidity()) return;
      // requestSubmit sends a submit event, so confirm, htmx and validation run.
      form.requestSubmit();
    }

    function handle(event) {
      var target = event.target;
      if (event.type === 'change' && target.matches && target.matches(TEXT_FIELD)) return;
      var form = (target && target.form) || el.closest('form');
      // Only a form around el, or el itself.
      if (!form || !(form === el || form.contains(el) || el.contains(form))) return;
      clearTimeout(timer);
      pending = form;
      if (delay > 0) timer = setTimeout(function () { submit(form); }, delay);
      else submit(form);
    }

    var offs = types.map(function (type) { return on(el, type, handle); });
    // A real submit cancels a pending autosubmit of the same form.
    offs.push(on(document, 'submit', function (event) {
      if (event.target === pending) {
        clearTimeout(timer);
        pending = null;
      }
    }, true));
    var off = all(offs);
    return function () {
      clearTimeout(timer);
      off();
    };
  });

  // ── count ──────────────────────────────────────────────────────────────

  var COUNT_FIELD = 'textarea, input:not([type=hidden])';

  register('count', function (el) {
    function field() {
      return el.matches(COUNT_FIELD) ? el : el.querySelector(COUNT_FIELD);
    }

    // The output must carry `data-vanilla-count-output`. Thus a selector
    // cannot write into other page content.
    function output() {
      var selector = opt(el, 'count');
      var found = selector ? query(selector) : el.querySelector('[data-vanilla-count-output]');
      return found && found.hasAttribute('data-vanilla-count-output') ? found : null;
    }

    function update() {
      var input = field();
      var out = output();
      if (!input || !out) return;
      // UTF-16 code units, the same unit as maxlength.
      var used = input.value.length;
      var max = input.maxLength;
      if (max < 0) out.textContent = String(used);
      else if (opt(el, 'count-mode') === 'remaining') out.textContent = String(Math.max(0, max - used));
      else out.textContent = used + '/' + max;
    }

    update();
    // Listen on el, not on the field. Thus a swapped field still counts.
    return all([
      on(el, 'input', update),
      // A reset changes the value after the event. Update one task later.
      on(document, 'reset', function (event) {
        if (event.target.contains(el)) setTimeout(update, 0);
      }, true),
    ]);
  });

  // ── local-time ─────────────────────────────────────────────────────────

  var STYLES = Object.create(null);
  STYLES.datetime = { dateStyle: 'medium', timeStyle: 'short' };
  STYLES.date = { dateStyle: 'medium' };
  STYLES.time = { timeStyle: 'short' };

  var DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

  // Smallest unit first.
  var UNITS = [
    ['second', 1],
    ['minute', 60],
    ['hour', 3600],
    ['day', 86400],
    ['week', 604800],
    ['month', 2592000],
    ['year', 31536000],
  ];

  function relative(date, locale) {
    var seconds = (date.getTime() - Date.now()) / 1000;
    var abs = Math.abs(seconds);
    var i = 0;
    // Go to a larger unit when the rounded value reaches it.
    // For example, 23h40m is "yesterday", not "24 hours ago".
    while (i < UNITS.length - 1 && Math.round(abs / UNITS[i][1]) * UNITS[i][1] >= UNITS[i + 1][1]) i++;
    var value = Math.round(seconds / UNITS[i][1]);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value === 0 ? 0 : value, UNITS[i][0]);
  }

  function formatTime(value, format, locale) {
    var day = DATE_ONLY.exec(value);
    // A date without a time is a calendar day, not UTC midnight.
    var date = day ? new Date(+day[1], +day[2] - 1, +day[3]) : new Date(value);
    if (isNaN(date.getTime())) return null;
    if (format === 'relative') return relative(date, locale);
    var style = day ? STYLES.date : STYLES[format] || STYLES.datetime;
    return new Intl.DateTimeFormat(locale, style).format(date);
  }

  function renderTime(time, format) {
    var value = time.getAttribute('datetime');
    var holder = time.closest('[lang]');
    var locale = (holder && holder.getAttribute('lang')) || undefined;
    var text;
    try {
      text = formatTime(value, format, locale);
    } catch (err) {
      // An invalid lang tag. Use the browser locale.
      text = formatTime(value, format, undefined);
    }
    if (text === null) return;
    if (!time.hasAttribute('title')) time.setAttribute('title', time.textContent.trim());
    time.textContent = text;
  }

  register('local-time', function (el) {
    var format = opt(el, 'local-time');
    each(el, 'time[datetime]', function (time) { renderTime(time, format); });
  });

  // ── Start ──────────────────────────────────────────────────────────────

  var api = Object.freeze({
    register: register,
    scan: scan,
    teardown: teardown,
    names: function () { return Object.keys(behaviors).sort(); },
  });
  window[KEY] = api;
  Object.defineProperty(window, 'Vanilla', { value: api, enumerable: true });

  document.addEventListener('htmx:load', function (event) {
    var elt = (event.detail && event.detail.elt) || event.target;
    if (!isNode(elt)) return;
    // A swap inside a bound element changes its content. Bind it again.
    for (var node = elt.nodeType === 1 ? elt : null; node; node = node.parentElement) rebind(node);
    scan(elt);
  });
  document.addEventListener('htmx:beforeCleanupElement', function (event) {
    // htmx sends this event for each removed element, so release one only.
    var elt = (event.detail && event.detail.elt) || event.target;
    if (elt && elt.nodeType === 1) release(elt);
  });

  function start() {
    ready = true;
    liveRegion();
    scan(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

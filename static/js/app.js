// Demo app behavior. It shows how an app adds its own behavior.
// It counts binds and cleanups, so the end-to-end test can read them.
window.demoStats = { binds: 0, cleanups: 0 };

Vanilla.register('greet', function (el) {
  window.demoStats.binds += 1;
  el.textContent = 'Hello, ' + (el.getAttribute('data-name') || 'friend') + '!';
  return function () {
    window.demoStats.cleanups += 1;
  };
});

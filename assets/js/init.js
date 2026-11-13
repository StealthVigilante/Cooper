/* Progressive enhancement: recover readable content if the main script fails. */
document.documentElement.classList.add('js');
try {
  if (window.sessionStorage.getItem('ctg-transition') === '1' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('is-entering');
  }
} catch (_) {}
window.setTimeout(function () {
  if (!window.ctgReady) {
    document.documentElement.classList.remove('js', 'is-entering', 'is-leaving');
    if (document.body) document.body.classList.add('is-loaded');
    document.querySelectorAll('[data-reveal], [data-split], .media[data-img], .log').forEach(function (el) { el.classList.add('is-in'); });
  }
}, 5000);

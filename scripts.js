// Scroll reveal
(function() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = document.querySelectorAll('[data-reveal]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  els.forEach(el => observer.observe(el));
})();

// Mobile menu toggle
document.querySelector('.hamburger').addEventListener('click', function() {
  document.getElementById('mobileMenu').classList.toggle('open');
});

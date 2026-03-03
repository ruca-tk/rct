// Initialize Lenis
const lenis = new Lenis({
    autoRaf: true,
  });
  
  // Listen for the scroll event and log the event data
  lenis.on('scroll', (e) => {
    console.log(e);
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      lenis.scrollTo(this.getAttribute('href'))
    });
  })

  //nav
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  function toggleNav() {
    hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open');
    document.body.classList.toggle('nav-open');
  }

  hamburger.addEventListener('click', toggleNav);
  // Optional: close menu when clicking outside
  window.addEventListener('click', function(e) {
    if (
      mobileNav.classList.contains('open') &&
      !mobileNav.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      toggleNav();
    }
  });
  // Optional: Close on escape key
  window.addEventListener('keydown', function(e) {
    if (e.key === "Escape" && mobileNav.classList.contains('open')) {
      toggleNav();
    }
  });
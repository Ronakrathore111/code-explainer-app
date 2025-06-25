// Toggle between Sign In / Sign Up
const signInBtnLink = document.querySelector('.signInBtn-link');
const signUpBtnLink = document.querySelector('.signUpBtn-link');
const wrapper = document.querySelector('.wrapper');

signUpBtnLink.addEventListener('click', () => wrapper.classList.toggle('active'));
signInBtnLink.addEventListener('click', () => wrapper.classList.toggle('active'));

// Handle Login
document.querySelector('.sign-in form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = e.target[0].value;
  const password = e.target[1].value;

  const res = await fetch('/login', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (res.ok) {
    window.location.href = "home.html";  // Redirect to AI code explanation page
  } else {
    alert(data.message || "Login failed.");
  }
});

// Handle Signup
document.querySelector('.sign-up form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = e.target[0].value;
  const email = e.target[1].value;
  const password = e.target[2].value;

  const res = await fetch('/signup', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password })
  });

  const data = await res.json();
  if (res.ok) {
    alert("Signup successful! You can now log in.");
    wrapper.classList.remove('active');
  } else {
    alert(data.message || "Signup failed.");
  }
});

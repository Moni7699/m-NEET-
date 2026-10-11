// m-NEET Authentication
// Firebase SDK and firebase.js must load before this file.

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");

function showForm(type) {
  const isLogin = type === "login";

  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;

  loginTab.classList.toggle("active", isLogin);
  registerTab.classList.toggle("active", !isLogin);

  clearMessages();
}

function clearMessages() {
  document.querySelectorAll(".message").forEach((element) => {
    element.textContent = "";
    element.className = "message";
  });
}

function showMessage(id, message, type = "error") {
  const element = document.getElementById(id);
  if (!element) return;

  element.textContent = message;
  element.className = `message ${type}`;
}

function friendlyError(error) {
  const messages = {
    "auth/invalid-email": "Email address সঠিক নয়।",
    "auth/user-not-found": "এই Email দিয়ে কোনো account পাওয়া যায়নি।",
    "auth/wrong-password": "Password সঠিক নয়।",
    "auth/invalid-credential": "Email অথবা Password সঠিক নয়।",
    "auth/email-already-in-use": "এই Email দিয়ে আগে থেকেই account আছে।",
    "auth/weak-password": "Password কমপক্ষে ৬ অক্ষরের হতে হবে।",
    "auth/network-request-failed": "Internet connection পরীক্ষা করো।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে চেষ্টা করো।"
  };

  return messages[error.code] || "সমস্যা হয়েছে। আবার চেষ্টা করো।";
}

function setLoading(form, loading) {
  const button = form.querySelector('button[type="submit"]');

  if (button) {
    button.disabled = loading;

    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent;
    }

    button.textContent = loading
      ? "Please wait..."
      : button.dataset.originalText;
  }
}

// Switch between Login and Registration
loginTab.addEventListener("click", () => showForm("login"));
registerTab.addEventListener("click", () => showForm("register"));

// Registration
registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();

  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const city = document.getElementById("city").value.trim();
  const password = document.getElementById("password").value;

  if (!fullName || !phone || !email || !city || !password) {
    showMessage("registerMessage", "সব তথ্য পূরণ করো।");
    return;
  }

  if (!/^[0-9+\-\s()]{8,20}$/.test(phone)) {
    showMessage("registerMessage", "সঠিক Phone Number দাও।");
    return;
  }

  setLoading(registerForm, true);

  try {
    const credential = await auth.createUserWithEmailAndPassword(
      email,
      password
    );

    const user = credential.user;

    await user.updateProfile({
      displayName: fullName
    });

    await db.collection("students").doc(user.uid).set({
      uid: user.uid,
      fullName,
      phone,
      email,
      city,
      role: "student",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showMessage(
      "registerMessage",
      "Registration সফল হয়েছে! Dashboard তৈরি হলে সেখানে যেতে পারবে।",
      "success"
    );

    // Dashboard redirect will be enabled after student.html is ready.
    registerForm.reset();

  } catch (error) {
    showMessage("registerMessage", friendlyError(error));
  } finally {
    setLoading(registerForm, false);
  }
});

// Login
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessages();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  setLoading(loginForm, true);

  try {
    await auth.signInWithEmailAndPassword(email, password);

    // Dashboard redirect will be enabled after student.html is ready.
    showMessage(
      "loginMessage",
      "Login সফল হয়েছে! Dashboard পরের ধাপে তৈরি হবে।",
      "success"
    );

  } catch (error) {
    showMessage("loginMessage", friendlyError(error));
  } finally {
    setLoading(loginForm, false);
  }
});

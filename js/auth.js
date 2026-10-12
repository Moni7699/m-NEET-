"use strict";

(() => {
const $ = (id) => document.getElementById(id);

const elements = {
message: $("message"),

loginForm: $("loginForm"),
registerForm: $("registerForm"),

loginTab: $("loginTab"),
registerTab: $("registerTab"),

loginEmail: $("loginEmail"),
loginPassword: $("loginPassword"),

registerName: $("registerName"),
registerPhone: $("registerPhone"),
registerEmail: $("registerEmail"),
registerCity: $("registerCity"),
registerPassword: $("registerPassword"),
confirmPassword: $("confirmPassword"),

loginButton: $("loginButton"),
registerButton: $("registerButton"),

forgotPassword: $("forgotPassword"),
rememberMe: $("rememberMe"),

formHeading: $("formHeading"),
formDescription: $("formDescription")

};

let auth = null;
let db = null;

let isSubmitting = false;
let authStateReady = false;
let authStateTimer = null;

const REMEMBERED_EMAIL_KEY = "mneetRememberedEmail";

// ----------------------------------------
// INITIALIZATION
// ----------------------------------------

function initialize() {
$("currentYear").textContent = new Date().getFullYear();

setupTabs();
setupPasswordToggles();
setupForms();
setupRememberedEmail();

const firebaseReady =
  typeof window.firebase !== "undefined" &&
  typeof window.auth !== "undefined" &&
  typeof window.db !== "undefined";

if (!firebaseReady) {
  showMessage(
    "Firebase initialize হয়নি। js/firebase.js এবং Firebase configuration পরীক্ষা করো।",
    "error"
  );
  return;
}

auth = window.auth;
db = window.db;

authStateTimer = setTimeout(() => {
  if (!authStateReady) {
    showMessage(
      "Firebase connection-এ দেরি হচ্ছে। Internet connection পরীক্ষা করে আবার চেষ্টা করো।",
      "error"
    );
  }
}, 12000);

auth.onAuthStateChanged(
  async (user) => {
    authStateReady = true;
    clearTimeout(authStateTimer);

    if (!user) {
      return;
    }

    // Never redirect while a login/register submission is in progress.
    if (isSubmitting) {
      return;
    }

    await routeAuthenticatedUser(user);
  },
  (error) => {
    authStateReady = true;
    clearTimeout(authStateTimer);

    console.error("Auth state error:", error);

    showMessage(
      "Login session যাচাই করা যায়নি। Internet ও Firebase configuration পরীক্ষা করো।",
      "error"
    );
  }
);

}

// ----------------------------------------
// LOGIN / REGISTER TABS
// ----------------------------------------

function setupTabs() {
elements.loginTab.addEventListener("click", showLoginForm);
elements.registerTab.addEventListener("click", showRegisterForm);

$("openRegister").addEventListener("click", showRegisterForm);
$("openLogin").addEventListener("click", showLoginForm);

}

function showLoginForm() {
elements.loginForm.hidden = false;
elements.registerForm.hidden = true;

elements.loginTab.classList.add("active");
elements.registerTab.classList.remove("active");

elements.loginTab.setAttribute("aria-selected", "true");
elements.registerTab.setAttribute("aria-selected", "false");

elements.formHeading.textContent = "Welcome Back!";
elements.formDescription.textContent =
  "Login to continue your NEET preparation.";

clearMessage();

}

function showRegisterForm() {
elements.loginForm.hidden = true;
elements.registerForm.hidden = false;

elements.loginTab.classList.remove("active");
elements.registerTab.classList.add("active");

elements.loginTab.setAttribute("aria-selected", "false");
elements.registerTab.setAttribute("aria-selected", "true");

elements.formHeading.textContent = "Create Your Account";
elements.formDescription.textContent =
  "Join m-NEET and start your preparation.";

clearMessage();

}

// ----------------------------------------
// PASSWORD VISIBILITY
// ----------------------------------------

function setupPasswordToggles() {
document.querySelectorAll(".password-toggle").forEach((button) => {
button.addEventListener("click", () => {
const input = $(button.dataset.target);

    if (!input) return;

    const willShow = input.type === "password";

    input.type = willShow ? "text" : "password";
    button.textContent = willShow ? "Hide" : "Show";

    button.setAttribute(
      "aria-label",
      willShow ? "Hide password" : "Show password"
    );
  });
});

}

// ----------------------------------------
// REMEMBER EMAIL
// ----------------------------------------

function setupRememberedEmail() {
try {
const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);

  if (savedEmail) {
    elements.loginEmail.value = savedEmail;
    elements.rememberMe.checked = true;
  }
} catch (error) {
  console.warn("Remember email unavailable:", error);
}

}

function saveRememberedEmail(email) {
try {
if (elements.rememberMe.checked) {
localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
} else {
localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}
} catch (error) {
console.warn("Could not save remembered email:", error);
}
}

// ----------------------------------------
// FORM EVENTS
// ----------------------------------------

function setupForms() {
elements.loginForm.addEventListener("submit", handleLogin);
elements.registerForm.addEventListener("submit", handleRegistration);

elements.forgotPassword.addEventListener(
  "click",
  handleForgotPassword
);

}

// ----------------------------------------
// LOGIN
// ----------------------------------------

async function handleLogin(event) {
event.preventDefault();

if (isSubmitting) return;

if (!auth || !db) {
  showMessage(
    "Firebase ready নয়। js/firebase.js পরীক্ষা করো।",
    "error"
  );
  return;
}

const email = elements.loginEmail.value.trim().toLowerCase();
const password = elements.loginPassword.value;

if (!email || !password) {
  showMessage("Email এবং password দুটোই দাও।", "error");
  return;
}

if (!elements.loginEmail.checkValidity()) {
  showMessage("সঠিক email address দাও।", "error");
  return;
}

saveRememberedEmail(email);

setSubmitting(true, "login");

try {
  const credential = await auth.signInWithEmailAndPassword(
    email,
    password
  );

  const user = credential.user;

  if (!user) {
    throw new Error("AUTH_USER_MISSING");
  }

  // Read the profile from the existing users collection.
  const profile = await getUserProfile(user.uid);

  if (!profile) {
    await auth.signOut();

    showMessage(
      "তোমার account-এর user profile পাওয়া যায়নি। Firestore-এর users collection পরীক্ষা করো।",
      "error"
    );

    return;
  }

  if (profile.status !== "active") {
    await auth.signOut();

    showMessage(
      "এই account সক্রিয় নয়। Admin-এর সাহায্য নাও।",
      "error"
    );

    return;
  }

  const role = normalizeRole(profile.role);

  if (role !== "student" && role !== "admin") {
    await auth.signOut();

    showMessage(
      "এই account-এর role সঠিকভাবে সেট করা নেই। Firestore-এর users document পরীক্ষা করো।",
      "error"
    );

    return;
  }

  showMessage("Login successful. Redirecting...", "success");

  redirectByRole(role);

} catch (error) {
  console.error("Login error:", error);

  showMessage(getFriendlyError(error), "error");

} finally {
  setSubmitting(false);
}

}

// ----------------------------------------
// REGISTRATION
// ----------------------------------------

async function handleRegistration(event) {
event.preventDefault();

if (isSubmitting) return;

if (!auth || !db) {
  showMessage(
    "Firebase ready নয়। js/firebase.js পরীক্ষা করো।",
    "error"
  );
  return;
}

const fullName = elements.registerName.value.trim();
const phone = elements.registerPhone.value.trim();
const email = elements.registerEmail.value.trim().toLowerCase();
const city = elements.registerCity.value.trim();

const password = elements.registerPassword.value;
const confirmPassword = elements.confirmPassword.value;

if (!fullName || !phone || !email || !city || !password) {
  showMessage("সব তথ্য পূরণ করো।", "error");
  return;
}

if (fullName.length < 2) {
  showMessage("Full Name অন্তত 2 অক্ষরের হতে হবে।", "error");
  return;
}

if (!/^[6-9]\d{9}$/.test(phone)) {
  showMessage(
    "সঠিক 10-digit Indian mobile number দাও।",
    "error"
  );
  return;
}

if (!elements.registerEmail.checkValidity()) {
  showMessage("সঠিক email address দাও।", "error");
  return;
}

if (password.length < 8) {
  showMessage(
    "Password অন্তত 8 অক্ষরের হতে হবে।",
    "error"
  );
  return;
}

if (password !== confirmPassword) {
  showMessage(
    "Password এবং Confirm Password মিলছে না।",
    "error"
  );
  return;
}

setSubmitting(true, "register");

let createdUser = null;

try {
  const credential = await auth.createUserWithEmailAndPassword(
    email,
    password
  );

  createdUser = credential.user;

  if (!createdUser) {
    throw new Error("AUTH_USER_MISSING");
  }

  await createdUser.updateProfile({
    displayName: fullName
  });

  // New public registrations are always students.
  // A user must never be able to choose the admin role here.
  const profile = {
    uid: createdUser.uid,
    fullName: fullName,
    phone: phone,
    email: email,
    city: city,
    role: "student",
    status: "active",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  await db.collection("users").doc(createdUser.uid).set(profile);

  saveRememberedEmail(email);

  showMessage(
    "Account created successfully. Opening Student Dashboard...",
    "success"
  );

  window.location.replace("student.html");

} catch (error) {
  console.error("Registration error:", error);

  // If Auth account creation succeeded but profile creation failed,
  // sign out to avoid leaving the user in a misleading session.
  if (createdUser) {
    try {
      await auth.signOut();
    } catch (signOutError) {
      console.error("Sign out after registration error:", signOutError);
    }
  }

  showMessage(getFriendlyError(error), "error");

} finally {
  setSubmitting(false);
}

}

// ----------------------------------------
// PASSWORD RESET
// ----------------------------------------

async function handleForgotPassword() {
if (!auth) {
showMessage("Firebase ready নয়।", "error");
return;
}

const email = elements.loginEmail.value.trim().toLowerCase();

if (!email) {
  showMessage(
    "Password reset করার আগে Email Address দাও।",
    "error"
  );

  elements.loginEmail.focus();
  return;
}

if (!elements.loginEmail.checkValidity()) {
  showMessage("সঠিক email address দাও।", "error");
  return;
}

try {
  elements.forgotPassword.disabled = true;

  await auth.sendPasswordResetEmail(email);

  showMessage(
    "যদি এই email-এ account থাকে, password reset email পাঠানো হয়েছে। Inbox ও Spam folder পরীক্ষা করো।",
    "success"
  );

} catch (error) {
  console.error("Password reset error:", error);

  showMessage(getFriendlyError(error), "error");

} finally {
  elements.forgotPassword.disabled = false;
}

}

// ----------------------------------------
// USER PROFILE
// ----------------------------------------

async function getUserProfile(uid) {
try {
const snapshot = await db.collection("users").doc(uid).get();

  if (!snapshot.exists) {
    return null;
  }

  return snapshot.data() || null;

} catch (error) {
  console.error("Profile fetch error:", error);
  throw error;
}

}

function normalizeRole(role) {
return String(role || "").trim().toLowerCase();
}

// ----------------------------------------
// EXISTING SESSION ROUTING
// ----------------------------------------

async function routeAuthenticatedUser(user) {
try {
const profile = await getUserProfile(user.uid);

  if (!profile) {
    showMessage(
      "Login session আছে, কিন্তু users profile পাওয়া যায়নি। Firestore document পরীক্ষা করো।",
      "error"
    );
    return;
  }

  if (profile.status !== "active") {
    showMessage(
      "এই account সক্রিয় নয়। Admin-এর সাহায্য নাও।",
      "error"
    );
    return;
  }

  const role = normalizeRole(profile.role);

  if (role === "admin") {
    window.location.replace("admin.html");
    return;
  }

  if (role === "student") {
    window.location.replace("student.html");
    return;
  }

  showMessage(
    "এই account-এর role সঠিকভাবে সেট করা নেই।",
    "error"
  );

} catch (error) {
  console.error("Session routing error:", error);

  showMessage(
    "Account profile যাচাই করা যায়নি। Firestore connection ও permissions পরীক্ষা করো।",
    "error"
  );
}

}

// ----------------------------------------
// ROLE REDIRECT
// ----------------------------------------

function redirectByRole(role) {
if (role === "admin") {
window.location.replace("admin.html");
return;
}

window.location.replace("student.html");

}

// ----------------------------------------
// LOADING STATES
// ----------------------------------------

function setSubmitting(loading, formType) {
isSubmitting = loading;

const button =
  formType === "register"
    ? elements.registerButton
    : elements.loginButton;

if (!button) return;

button.disabled = loading;

const text = button.querySelector(".button-text");
const loader = button.querySelector(".button-loader");

if (text) {
  if (!button.dataset.originalText) {
    button.dataset.originalText = text.textContent;
  }

  text.textContent = loading
    ? (formType === "register" ? "Creating Account..." : "Logging in...")
    : button.dataset.originalText;
}

if (loader) {
  loader.hidden = !loading;
}

}

// ----------------------------------------
// MESSAGES
// ----------------------------------------

function showMessage(message, type) {
if (!elements.message) return;

elements.message.textContent = message;
elements.message.className = "message " + type;
elements.message.hidden = false;

}

function clearMessage() {
if (!elements.message) return;

elements.message.textContent = "";
elements.message.hidden = true;
elements.message.className = "message";

}

// ----------------------------------------
// FIREBASE ERROR MESSAGES
// ----------------------------------------

function getFriendlyError(error) {
const code = error && error.code ? error.code : "";
const message = error && error.message ? error.message : "";

switch (code) {
  case "auth/invalid-email":
    return "Email address সঠিক নয়।";

  case "auth/user-not-found":
  case "auth/wrong-password":
  case "auth/invalid-credential":
    return "Email অথবা Password সঠিক নয়।";

  case "auth/email-already-in-use":
    return "এই Email দিয়ে আগে থেকেই account আছে। Login করো।";

  case "auth/weak-password":
    return "আরও শক্তিশালী password ব্যবহার করো।";

  case "auth/too-many-requests":
    return "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করো।";

  case "auth/network-request-failed":
    return "Internet connection পরীক্ষা করে আবার চেষ্টা করো।";

  case "auth/operation-not-allowed":
    return "Firebase Console-এ Email/Password Authentication চালু আছে কি না পরীক্ষা করো।";

  case "auth/invalid-api-key":
    return "Firebase API key সঠিক নয়। js/firebase.js পরীক্ষা করো।";

  case "permission-denied":
  case "firestore/permission-denied":
    return "Firestore permission-এর কারণে profile পড়া বা সংরক্ষণ করা যায়নি।";

  case "AUTH_USER_MISSING":
    return "Firebase user পাওয়া যায়নি। আবার চেষ্টা করো।";

  default:
    console.error("Unhandled Firebase error:", code, message);

    return "কাজটি সম্পন্ন হয়নি। Internet connection, Firebase configuration এবং Console error পরীক্ষা করো।";
}

}

// ----------------------------------------
// START
// ----------------------------------------

if (document.readyState === "loading") {
document.addEventListener("DOMContentLoaded", initialize);
} else {
initialize();
}

})();

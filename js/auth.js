/* =========================================
   mNEET AUTH SYSTEM
   Login • Registration • Password Reset
   Theme Switch • Student Profile
========================================= */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const loginForm = $("loginForm");
  const registerForm = $("registerForm");
  const loginTab = $("loginTab");
  const registerTab = $("registerTab");
  const messageBox = $("message");
  const themeToggle = $("themeToggle");

  let registrationInProgress = false;
  let redirectInProgress = false;

  /* ---------- STATUS MESSAGE ---------- */

  function showMessage(message, type = "error") {
    messageBox.textContent = message;
    messageBox.className = "message show " + type;
  }

  function clearMessage() {
    messageBox.textContent = "";
    messageBox.className = "message";
  }

  /* ---------- FORM SWITCH ---------- */

  function showLogin() {
    clearMessage();

    loginForm.hidden = false;
    registerForm.hidden = true;

    loginTab.classList.add("active");
    registerTab.classList.remove("active");
  }

  function showRegister() {
    clearMessage();

    loginForm.hidden = true;
    registerForm.hidden = false;

    loginTab.classList.remove("active");
    registerTab.classList.add("active");
  }

  loginTab.addEventListener("click", showLogin);
  registerTab.addEventListener("click", showRegister);
  $("openRegister").addEventListener("click", showRegister);
  $("openLogin").addEventListener("click", showLogin);

  /* ---------- SHOW / HIDE PASSWORD ---------- */

  document.querySelectorAll(".show-password").forEach((button) => {
    button.addEventListener("click", function () {
      const input = $(this.dataset.target);

      if (!input) return;

      const showing = input.type === "text";

      input.type = showing ? "password" : "text";
      this.textContent = showing ? "Show" : "Hide";
      this.setAttribute(
        "aria-label",
        showing ? "Show password" : "Hide password"
      );
    });
  });

  /* ---------- THEME ---------- */

  function applyTheme(theme) {
    const dark = theme === "dark";

    document.body.classList.toggle("dark", dark);

    themeToggle.textContent = dark
      ? "☀️ Light Mode"
      : "🌙 Dark Mode";

    themeToggle.setAttribute(
      "aria-pressed",
      String(dark)
    );
  }

  const savedTheme = localStorage.getItem("mneetTheme");
  applyTheme(savedTheme === "dark" ? "dark" : "white");

  themeToggle.addEventListener("click", function () {
    const isDark = document.body.classList.contains("dark");
    const nextTheme = isDark ? "white" : "dark";

    localStorage.setItem("mneetTheme", nextTheme);
    applyTheme(nextTheme);
  });

  /* ---------- FIREBASE CHECK ---------- */

  function firebaseReady() {
    if (
      window.mneetFirebaseReady !== true ||
      !window.auth ||
      !window.db
    ) {
      showMessage(
        "Firebase is not configured. Check js/firebase.js and your Firebase settings."
      );
      return false;
    }

    return true;
  }

  /* ---------- FIREBASE ERROR TEXT ---------- */

  function friendlyError(error) {
    const code = error && error.code;

    const errors = {
      "auth/invalid-email": "Enter a valid email address.",
      "auth/user-not-found": "No account found with this email.",
      "auth/wrong-password": "Incorrect email or password.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/email-already-in-use": "This email is already registered.",
      "auth/weak-password": "Choose a stronger password.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/network-request-failed": "Network error. Check your internet.",
      "permission-denied": "Database permission denied. Check Firestore Rules.",
      "unavailable": "Service unavailable. Try again."
    };

    return errors[code] ||
      (error && error.message) ||
      "Something went wrong. Please try again.";
  }

  /* ---------- BUTTON LOADING ---------- */

  function setButtonLoading(button, loading, text) {
    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : text;
  }

  /* ---------- REGISTRATION ---------- */

  registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearMessage();

    if (!firebaseReady()) return;

    const fullName = $("fullName").value.trim();
    const phone = $("phone").value.trim();
    const city = $("city").value.trim();
    const email = $("registerEmail").value.trim();
    const password = $("registerPassword").value;

    if (!fullName || !phone || !city || !email || !password) {
      showMessage("Please complete all fields.");
      return;
    }

    if (!/^[0-9]{10}$/.test(phone)) {
      showMessage("Enter a valid 10-digit phone number.");
      return;
    }

    if (password.length < 6) {
      showMessage("Password must contain at least 6 characters.");
      return;
    }

    const button = $("registerButton");
    setButtonLoading(button, true, "Create Account");

    let createdUser = null;

    try {
      registrationInProgress = true;

      const credential = await auth.createUserWithEmailAndPassword(
        email,
        password
      );

      createdUser = credential.user;

      // Create student profile in Firestore.
      await db.collection("users").doc(createdUser.uid).set({
        uid: createdUser.uid,
        fullName: fullName,
        phone: phone,
        city: city,
        email: email,
        role: "student",
        status: "active",
        createdAt: serverTimestamp()
      });

      showMessage("Account created successfully!", "success");

      window.location.replace("student.html");

    } catch (error) {
      console.error("Registration error:", error);

      // If profile creation failed, avoid leaving an incomplete
      // authenticated session on this page.
      if (createdUser) {
        try {
          await auth.signOut();
        } catch (signOutError) {
          console.error("Sign-out error:", signOutError);
        }
      }

      showMessage(friendlyError(error));

    } finally {
      registrationInProgress = false;
      setButtonLoading(button, false, "Create Account");
    }
  });

  /* ---------- LOGIN ---------- */

  loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    clearMessage();

    if (!firebaseReady()) return;

    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;

    if (!email || !password) {
      showMessage("Enter your email and password.");
      return;
    }

    const button = $("loginButton");
    setButtonLoading(button, true, "Login");

    try {
      const credential = await auth.signInWithEmailAndPassword(
        email,
        password
      );

      // Verify that this account has a valid student profile.
      const profile = await db
        .collection("users")
        .doc(credential.user.uid)
        .get();

      if (!profile.exists) {
        await auth.signOut();
        showMessage(
          "Student profile not found. Please contact the administrator."
        );
        return;
      }

      const data = profile.data();

      if (data.role !== "student" || data.status !== "active") {
        await auth.signOut();
        showMessage(
          "This account does not have active student access."
        );
        return;
      }

      showMessage("Login successful!", "success");
      window.location.replace("student.html");

    } catch (error) {
      console.error("Login error:", error);
      showMessage(friendlyError(error));

    } finally {
      setButtonLoading(button, false, "Login");
    }
  });

  /* ---------- FORGOT PASSWORD ---------- */

  $("forgotPassword").addEventListener("click", async function () {
    clearMessage();

    if (!firebaseReady()) return;

    const email = $("loginEmail").value.trim();

    if (!email) {
      showMessage("Enter your email first to reset your password.");
      $("loginEmail").focus();
      return;
    }

    try {
      await auth.sendPasswordResetEmail(email);

      showMessage(
        "Password reset email sent. Check your inbox.",
        "success"
      );

    } catch (error) {
      console.error("Password reset error:", error);
      showMessage(friendlyError(error));
    }
  });

  /* ---------- EXISTING SESSION ---------- */

  if (window.mneetFirebaseReady === true && window.auth) {
    auth.onAuthStateChanged(async function (user) {
      if (!user || registrationInProgress || redirectInProgress) {
        return;
      }

      try {
        const profile = await db
          .collection("users")
          .doc(user.uid)
          .get();

        if (!profile.exists) return;

        const data = profile.data();

        if (data.role === "student" && data.status === "active") {
          redirectInProgress = true;
          window.location.replace("student.html");
        }

      } catch (error) {
        console.error("Session verification error:", error);
      }
    });
  }

})();

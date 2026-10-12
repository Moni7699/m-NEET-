/* =========================================
   mNEET AUTH SYSTEM
   Student + Admin Login
   Registration • Password Reset
   Theme Switch • Session Redirect
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
  let loginInProgress = false;
  let redirectInProgress = false;

  /* ---------- STATUS MESSAGE ---------- */

  function showMessage(message, type = "error") {
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = "message show " + type;
  }

  function clearMessage() {
    if (!messageBox) return;

    messageBox.textContent = "";
    messageBox.className = "message";
  }

  /* ---------- FORM SWITCH ---------- */

  function showLogin() {
    clearMessage();

    if (loginForm) loginForm.hidden = false;
    if (registerForm) registerForm.hidden = true;

    if (loginTab) loginTab.classList.add("active");
    if (registerTab) registerTab.classList.remove("active");
  }

  function showRegister() {
    clearMessage();

    if (loginForm) loginForm.hidden = true;
    if (registerForm) registerForm.hidden = false;

    if (loginTab) loginTab.classList.remove("active");
    if (registerTab) registerTab.classList.add("active");
  }

  if (loginTab) loginTab.addEventListener("click", showLogin);
  if (registerTab) registerTab.addEventListener("click", showRegister);

  if ($("openRegister")) {
    $("openRegister").addEventListener("click", showRegister);
  }

  if ($("openLogin")) {
    $("openLogin").addEventListener("click", showLogin);
  }

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
    if (!document.body || !themeToggle) return;

    const dark = theme === "dark";

    document.body.classList.toggle("dark", dark);

    themeToggle.textContent = dark
      ? "☀️ Light Mode"
      : "🌙 Dark Mode";

    themeToggle.setAttribute("aria-pressed", String(dark));
  }

  function loadTheme() {
    const savedTheme = localStorage.getItem("mneetTheme");
    applyTheme(savedTheme === "dark" ? "dark" : "light");
  }

  loadTheme();

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const isDark = document.body.classList.contains("dark");
      const nextTheme = isDark ? "light" : "dark";

      localStorage.setItem("mneetTheme", nextTheme);
      applyTheme(nextTheme);
    });
  }

  /* ---------- FIREBASE CHECK ---------- */

  function firebaseReady() {
    if (
      window.mneetFirebaseReady !== true ||
      !window.auth ||
      !window.db
    ) {
      showMessage(
        "Firebase is not configured. Check js/firebase.js and Firebase settings."
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
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : text;
  }

  /* ---------- PROFILE LOOKUP ---------- */

  async function getUserProfile(uid) {
    const snapshot = await db.collection("users").doc(uid).get();

    if (!snapshot.exists) {
      return null;
    }

    return snapshot.data() || {};
  }

  /* ---------- ROLE-BASED REDIRECT ---------- */

  function redirectByRole(profile) {
    if (redirectInProgress) return;

    if (!profile || profile.status !== "active") {
      showMessage(
        "This account is not active. Please contact the administrator."
      );
      return;
    }

    let destination = "";

    if (profile.role === "admin") {
      destination = "admin.html";
    } else if (profile.role === "student") {
      destination = "student.html";
    } else {
      showMessage(
        "This account has no valid role. Please contact the administrator."
      );
      return;
    }

    redirectInProgress = true;
    window.location.replace(destination);
  }

  /* ---------- REGISTRATION ---------- */

  if (registerForm) {
    registerForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearMessage();

      if (!firebaseReady()) return;

      const fullName = $("fullName")?.value.trim() || "";
      const phone = $("phone")?.value.trim() || "";
      const city = $("city")?.value.trim() || "";
      const email = $("registerEmail")?.value.trim() || "";
      const password = $("registerPassword")?.value || "";

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

        redirectInProgress = true;
        window.location.replace("student.html");

      } catch (error) {
        console.error("Registration error:", error);

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
  }

  /* ---------- LOGIN: ADMIN + STUDENT ---------- */

  if (loginForm) {
    loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearMessage();

      if (!firebaseReady()) return;
      if (loginInProgress) return;

      const email = $("loginEmail")?.value.trim() || "";
      const password = $("loginPassword")?.value || "";

      if (!email || !password) {
        showMessage("Enter your email and password.");
        return;
      }

      const button = $("loginButton");

      loginInProgress = true;
      setButtonLoading(button, true, "Login");

      try {
        const credential = await auth.signInWithEmailAndPassword(
          email,
          password
        );

        const profile = await getUserProfile(credential.user.uid);

        if (!profile) {
          await auth.signOut();

          showMessage(
            "User profile not found. Contact the administrator."
          );

          return;
        }

        // Both Admin and Student are handled here.
        // Admin is not incorrectly rejected as a non-student.
        if (profile.status !== "active") {
          await auth.signOut();

          showMessage(
            "This account is not active. Please contact the administrator."
          );

          return;
        }

        if (profile.role === "admin") {
          showMessage("Admin login successful!", "success");

          redirectInProgress = true;
          window.location.replace("admin.html");
          return;
        }

        if (profile.role === "student") {
          showMessage("Student login successful!", "success");

          redirectInProgress = true;
          window.location.replace("student.html");
          return;
        }

        await auth.signOut();

        showMessage(
          "This account has no valid role. Contact the administrator."
        );

      } catch (error) {
        console.error("Login error:", error);
        showMessage(friendlyError(error));

      } finally {
        loginInProgress = false;
        setButtonLoading(button, false, "Login");
      }
    });
  }

  /* ---------- FORGOT PASSWORD ---------- */

  if ($("forgotPassword")) {
    $("forgotPassword").addEventListener("click", async function () {
      clearMessage();

      if (!firebaseReady()) return;

      const email = $("loginEmail")?.value.trim() || "";

      if (!email) {
        showMessage("Enter your email first to reset your password.");
        $("loginEmail")?.focus();
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
  }

  /* ---------- EXISTING SESSION ---------- */

  if (
    window.mneetFirebaseReady === true &&
    window.auth &&
    window.db
  ) {
    auth.onAuthStateChanged(async function (user) {
      if (
        !user ||
        registrationInProgress ||
        loginInProgress ||
        redirectInProgress
      ) {
        return;
      }

      try {
        const profile = await getUserProfile(user.uid);

        if (!profile) {
          return;
        }

        // Send already-signed-in users to their correct dashboard.
        if (
          profile.status === "active" &&
          (profile.role === "admin" || profile.role === "student")
        ) {
          redirectByRole(profile);
        }

      } catch (error) {
        console.error("Session verification error:", error);
      }
    });
  }

})();

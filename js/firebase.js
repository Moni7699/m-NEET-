// firebase.js
// mNEET Student App + Admin App
// Firebase SDK: Compat v12.19.0

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "mneet-spark.firebaseapp.com",
  projectId: "mneet-spark",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

const serverTimestamp = () =>
  firebase.firestore.FieldValue.serverTimestamp();

// Current logged-in user
function getCurrentUser() {
  return auth.currentUser;
}

// Sign in
async function loginUser(email, password) {
  const result = await auth.signInWithEmailAndPassword(
    email.trim(),
    password
  );

  return result.user;
}

// Sign out
async function logoutUser() {
  await auth.signOut();
  localStorage.clear();
  window.location.href = "index.html";
}

// Create a subject
async function createSubject(subjectId, name) {
  await db.collection("subjects").doc(subjectId).set({
    name: name.trim(),
    published: false,
    createdAt: serverTimestamp()
  });

  return true;
}

// Create a chapter
async function createChapter(subjectId, chapterId, name, order = 1) {
  await db
    .collection("subjects")
    .doc(subjectId)
    .collection("chapters")
    .doc(chapterId)
    .set({
      name: name.trim(),
      order: Number(order),
      published: false,
      createdAt: serverTimestamp()
    });

  return true;
}

// Admin creates a quiz type.
// Quiz types are NOT predefined.
async function createQuizType(
  subjectId,
  chapterId,
  quizTypeId,
  name,
  order = 1
) {
  await db
    .collection("subjects")
    .doc(subjectId)
    .collection("chapters")
    .doc(chapterId)
    .collection("quizTypes")
    .doc(quizTypeId)
    .set({
      name: name.trim(),
      order: Number(order),
      published: false,
      createdAt: serverTimestamp()
    });

  return true;
}

// Admin creates a question
async function createQuestion(
  subjectId,
  chapterId,
  quizTypeId,
  questionId,
  questionData
) {
  const correctOption = String(questionData.correctOption || "").toUpperCase();

  if (!questionData.question || !questionData.options) {
    throw new Error("Question and options are required.");
  }

  if (!["A", "B", "C", "D"].includes(correctOption)) {
    throw new Error("Correct option must be A, B, C or D.");
  }

  await db
    .collection("subjects")
    .doc(subjectId)
    .collection("chapters")
    .doc(chapterId)
    .collection("quizTypes")
    .doc(quizTypeId)
    .collection("questions")
    .doc(questionId)
    .set({
      question: questionData.question,
      options: questionData.options,
      correctOption,
      solution: questionData.solution || "",
      imageUrl: questionData.imageUrl || "",
      published: false,
      createdAt: serverTimestamp()
    });

  return true;
}

// Load published subjects for students
async function getPublishedSubjects() {
  const snapshot = await db
    .collection("subjects")
    .where("published", "==", true)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

// Load published chapters
async function getPublishedChapters(subjectId) {
  const snapshot = await db
    .collection("subjects")
    .doc(subjectId)
    .collection("chapters")
    .where("published", "==", true)
    .get();

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Load only quiz types created and published by admin
async function getPublishedQuizTypes(subjectId, chapterId) {
  const snapshot = await db
    .collection("subjects")
    .doc(subjectId)
    .collection("chapters")
    .doc(chapterId)
    .collection("quizTypes")
    .where("published", "==", true)
    .get();

  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

// Load published questions
async function getPublishedQuestions(subjectId, chapterId, quizTypeId) {
  const snapshot = await db
    .collection("subjects")
    .doc(subjectId)
    .collection("chapters")
    .doc(chapterId)
    .collection("quizTypes")
    .doc(quizTypeId)
    .collection("questions")
    .where("published", "==", true)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

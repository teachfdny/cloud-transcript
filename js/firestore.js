// =====================
// FIRESTORE DATA LAYER
// Cloud Transcript Generator — storage for transcript meta, courses, and exams
// Exposes functions via window so planner.js (regular script) can call them
// =====================

import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    collection,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';

// =====================
// FIREBASE INIT
// Reuse existing app if already initialized by firebase-sync.js
// =====================
const firebaseConfig = {
    apiKey: "AIzaSyA6NwRZfx0vb_IZOJsJwIPkrN6efUgXBDI",
    authDomain: "ataleofchanges-homeschool.firebaseapp.com",
    projectId: "ataleofchanges-homeschool",
    storageBucket: "ataleofchanges-homeschool.firebasestorage.app",
    messagingSenderId: "192724354270",
    appId: "1:192724354270:web:93973ba3913dbdff8b6e4f"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// =====================
// TRANSCRIPT INIT
// On first use: create a transcript document with a generated ID.
// On subsequent loads: find and return the existing transcriptId.
// Structure: users/{uid}/transcripts/{transcriptId}
// =====================
async function initTranscript(uid) {
    const transcriptsRef = collection(db, 'users', uid, 'transcripts');
    const snap = await getDocs(transcriptsRef);

    if (!snap.empty) {
        // Return the first (and currently only) transcript
        return snap.docs[0].id;
    }

    // No transcript yet — create one with a generated ID
    const newId = crypto.randomUUID();
    await setDoc(doc(db, 'users', uid, 'transcripts', newId), {
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    return newId;
}

// =====================
// LOAD TRANSCRIPT DATA
// Fetches transcript meta + all courses + all exams in parallel.
// Returns { meta, courses, exams } shaped for currentPlan.
// =====================
async function loadTranscriptData(uid, transcriptId) {
    const transcriptRef = doc(db, 'users', uid, 'transcripts', transcriptId);
    const coursesRef    = collection(db, 'users', uid, 'transcripts', transcriptId, 'courses');
    const examsRef      = collection(db, 'users', uid, 'transcripts', transcriptId, 'exams');

    const [transcriptSnap, coursesSnap, examsSnap] = await Promise.all([
        getDoc(transcriptRef),
        getDocs(coursesRef),
        getDocs(examsRef)
    ]);

    // Transcript meta (student + school info)
    const meta = transcriptSnap.exists() ? transcriptSnap.data() : {};

    // Courses — group by year
    const courses = { 8: [], 9: [], 10: [], 11: [], 12: [] };
    coursesSnap.forEach(docSnap => {
        const course = docSnap.data();
        const year   = course.year;
        if (courses[year] !== undefined) {
            courses[year].push(course);
        }
    });

    // Exams — flat array
    const exams = [];
    examsSnap.forEach(docSnap => {
        exams.push(docSnap.data());
    });

    return { meta, courses, exams };
}

// =====================
// SAVE TRANSCRIPT META
// Writes student + school info fields to the transcript document.
// Does not touch courses or exams.
// =====================
async function saveTranscriptMeta(uid, transcriptId, data) {
    const transcriptRef = doc(db, 'users', uid, 'transcripts', transcriptId);
    await setDoc(transcriptRef, {
        studentName:    data.studentName    || '',
        schoolName:     data.schoolName     || '',
        graduationYear: data.graduationYear || '',
        studentDOB:     data.studentDOB     || '',
        studentAddress: data.studentAddress || '',
        schoolAddress:  data.schoolAddress  || '',
        schoolPhone:    data.schoolPhone    || '',
        schoolEmail:    data.schoolEmail    || '',
        schoolWebsite:  data.schoolWebsite  || '',
        updatedAt:      serverTimestamp()
    }, { merge: true });
}

// =====================
// SAVE COURSE
// Upserts a single course document.
// Course must have a stable string id (UUID).
// =====================
async function saveCourse(uid, transcriptId, course) {
    const courseRef = doc(db, 'users', uid, 'transcripts', transcriptId, 'courses', String(course.id));
    await setDoc(courseRef, {
        id:        course.id,
        name:      course.name,
        credits:   course.credits,
        grade:     course.grade,
        type:      course.type,
        gpaPoints: course.gpaPoints,
        subject:   course.subject   || '',
        year:      course.year,
        createdAt: course.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp()
    }, { merge: true });
}

// =====================
// DELETE COURSE
// =====================
async function deleteCourse(uid, transcriptId, courseId) {
    const courseRef = doc(db, 'users', uid, 'transcripts', transcriptId, 'courses', String(courseId));
    await deleteDoc(courseRef);
}

// =====================
// SAVE EXAM
// Upserts a single exam document.
// =====================
async function saveExam(uid, transcriptId, exam) {
    const examRef = doc(db, 'users', uid, 'transcripts', transcriptId, 'exams', String(exam.id));
    await setDoc(examRef, {
        id:    exam.id,
        name:  exam.name,
        date:  exam.date  || '',
        score: exam.score || '',
        updatedAt: serverTimestamp()
    }, { merge: true });
}

// =====================
// DELETE EXAM
// =====================
async function deleteExam(uid, transcriptId, examId) {
    const examRef = doc(db, 'users', uid, 'transcripts', transcriptId, 'exams', String(examId));
    await deleteDoc(examRef);
}

// =====================
// EXPOSE TO WINDOW
// planner.js is a regular script and cannot import modules directly.
// All functions needed by planner.js are attached to window here.
// =====================
window.firestoreReady = false;
window.currentUid     = null;
window.transcriptId   = null;

window.fsInitTranscript    = initTranscript;
window.fsLoadTranscriptData = loadTranscriptData;
window.fsSaveTranscriptMeta = saveTranscriptMeta;
window.fsSaveCourse        = saveCourse;
window.fsDeleteCourse      = deleteCourse;
window.fsSaveExam          = saveExam;
window.fsDeleteExam        = deleteExam;

// =====================
// AUTH STATE — notify planner.js when ready
// Fires after auth resolves, sets global uid + transcriptId,
// then calls window.onFirestoreReady() which planner.js defines.
// =====================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            window.currentUid   = user.uid;
            window.transcriptId = await initTranscript(user.uid);
            window.firestoreReady = true;
            if (typeof window.onFirestoreReady === 'function') {
                window.onFirestoreReady();
            }
        } catch (err) {
            console.error('Firestore init error:', err);
        }
    } else {
        window.firestoreReady = false;
        window.currentUid     = null;
        window.transcriptId   = null;
    }
});

// =====================
// OPEN COURSE DESCRIPTIONS
// Opens descriptions.html in a new tab, passing the current transcript ID
// as a query param so the builder loads the correct transcript.
// Must be called after Firestore is ready (window.transcriptId is set).
// =====================
window.openDescriptions = function () {
    if (!window.transcriptId) {
        alert('Save your plan first before opening Course Descriptions.');
        return;
    }
    window.open(`descriptions.html?tid=${window.transcriptId}`, '_blank');
};

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-course-descriptions');
    if (btn) btn.addEventListener('click', window.openDescriptions);
});

// =====================
// FIREBASE SYNC
// Generator side — reads sync snapshots written by the Record Keeper
// =====================

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyA6NwRZfx0vb_IZOJsJwIPkrN6efUgXBDI",
  authDomain: "ataleofchanges-homeschool.firebaseapp.com",
  projectId: "ataleofchanges-homeschool",
  storageBucket: "ataleofchanges-homeschool.firebasestorage.app",
  messagingSenderId: "192724354270",
  appId: "1:192724354270:web:93973ba3913dbdff8b6e4f"
};

// Avoid re-initializing if already loaded
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// =====================
// GRADE MAPPING
// Keeper grade chip values → Generator course year keys
// =====================
const GRADE_TO_YEAR = {
  '8th':  8,
  '9th':  9,
  '10th': 10,
  '11th': 11,
  '12th': 12
};

// =====================
// COURSE TYPE PASSTHROUGH
// Keeper gpaLevel values match Generator courseType values exactly
// =====================
function mapCourseType(gpaLevel) {
  const valid = ['Regular', 'Honors', 'AP', 'IB', 'Dual Enrollment'];
  return valid.includes(gpaLevel) ? gpaLevel : 'Regular';
}

// =====================
// AUTH STATE
// Tracked here so importFromKeeper can check it
// Auth wiring (sign-in UI) is handled separately and added later
// =====================
let syncUser = null;



// =====================
// IMPORT FROM KEEPER
// =====================
async function importFromKeeper() {
  if (!syncUser) {
    alert('You must be signed in to import from the Record Keeper.\n\nSign-in will be available in the Generator shortly — check back soon.');
    return;
  }

  const uid = syncUser.uid;

  // Fetch all syncSnapshot docs to find available children
  // For now we read a single doc — child picker will be added with auth UI
  // We need a childId to read the right snapshot. Until the child picker exists,
  // we check if there's only one snapshot and use it automatically, otherwise prompt.
  let snapshot;
  let childId;

  try {
    // Try to get the list of children from the user's family doc
    const { getDoc: _getDoc, doc: _doc } = await import('https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js');
    const familyRef = doc(db, 'users', uid, 'tracker', 'family');
    const familySnap = await getDoc(familyRef);

    if (!familySnap.exists()) {
      alert('❌ No Record Keeper data found for this account. Make sure you\'re signed in with the same account you use in the Record Keeper.');
      return;
    }

    const family = familySnap.data();
    const children = family.children || [];
    const hsChildren = children.filter(c => GRADE_TO_YEAR[c.grade]);

    if (hsChildren.length === 0) {
      alert('❌ No high school grade children found in your Record Keeper. Only grades 8th–12th can be synced to the Transcript Generator.');
      return;
    }

    // If multiple eligible children, ask which one
    if (hsChildren.length === 1) {
      childId = String(hsChildren[0].id);
    } else {
      const options = hsChildren.map((c, i) => `${i + 1}. ${c.name} (${c.grade} grade)`).join('\n');
      const choice = prompt(`Which child would you like to import?\n\n${options}\n\nEnter a number:`);
      const idx = parseInt(choice) - 1;
      if (isNaN(idx) || idx < 0 || idx >= hsChildren.length) {
        alert('Invalid selection. Import cancelled.');
        return;
      }
      childId = String(hsChildren[idx].id);
    }

    // Read the sync snapshot for that child
    const snapRef = doc(db, 'users', uid, 'syncSnapshots', childId);
    const snapDoc = await getDoc(snapRef);

    if (!snapDoc.exists()) {
      alert('❌ No sync data found for this child.\n\nMake sure you\'ve clicked "Sync selected courses" in the Record Keeper first, then try again.');
      return;
    }

    snapshot = snapDoc.data();

  } catch (err) {
    console.error('Import error:', err);
    alert('❌ Could not read sync data. Check your connection and try again.\n\n' + err.message);
    return;
  }

  // Validate grade maps to a Generator year
  const targetYear = GRADE_TO_YEAR[snapshot.grade];
  if (!targetYear) {
    alert(`❌ Cannot import: grade "${snapshot.grade}" is not a supported high school grade (8th–12th).`);
    return;
  }

  const incomingCourses = snapshot.courses || [];
  if (incomingCourses.length === 0) {
    alert('❌ The sync snapshot has no courses. Try syncing again from the Record Keeper.');
    return;
  }

  // Warn and confirm if replacing existing courses
  const existingCount = (currentPlan.courses[targetYear] || []).length;
  if (existingCount > 0) {
    const confirmed = confirm(
      `You already have ${existingCount} course(s) entered for ${snapshot.grade} grade.\n\n` +
      `Importing will replace all of them with ${incomingCourses.length} course(s) from the Record Keeper.\n\n` +
      `The sync is a one-time starting point. Going forward, manage your transcript data here in the Generator — do not rely on re-syncing to update it.\n\n` +
      `This cannot be undone. Continue?`
    );
    if (!confirmed) return;
  }

  // Map Keeper payload → Generator course shape
  const mappedCourses = incomingCourses.map(course => ({
    id: Date.now() + Math.floor(Math.random() * 10000),
    name: course.name,
    credits: course.credits || 1,
    grade: course.grade || '',
    type: mapCourseType(course.type),
    gpaPoints: course.grade ? getGPAPoints(course.grade, mapCourseType(course.type)) : null
  }));

  // Replace the year's courses
  currentPlan.courses[targetYear] = mappedCourses;

  // Save to localStorage and refresh UI
  savePlan();
  updateUI();

  const syncDate = new Date(snapshot.syncedAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric'
  });
  alert(`✅ Imported ${mappedCourses.length} course(s) into ${snapshot.grade} grade.\n\nSynced from Record Keeper: ${syncDate}\n\nReview the courses and make any adjustments needed.`);
}

// =====================
// BUTTON WIRING
// =====================
const btn = document.getElementById('importFromKeeper');
if (btn) {
  btn.addEventListener('click', importFromKeeper);
}
// =====================
// AUTH FUNCTIONS
// =====================
import { signInWithEmailAndPassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';

function showAuthTab(tab) {
  document.getElementById('auth-signin-form').style.display = tab === 'signin' ? 'block' : 'none';
  document.getElementById('auth-magic-form').style.display = tab === 'magic' ? 'block' : 'none';
  document.getElementById('auth-magic-sent').style.display = 'none';
  document.getElementById('tab-signin').classList.toggle('active', tab === 'signin');
  document.getElementById('tab-magic').classList.toggle('active', tab === 'magic');
}

function showAuthError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

function hideAuthError(elementId) {
  const el = document.getElementById(elementId);
  if (el) el.style.display = 'none';
}

function getAuthErrorMessage(code) {
  const messages = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/invalid-credential': 'Incorrect email or password.',
  };
  return messages[code] || 'Something went wrong. Please try again.';
}

function showMainApp() {
  document.getElementById('authScreen').classList.add('hidden');
}

function showAuthScreen(form = 'signin') {
  document.getElementById('authScreen').classList.remove('hidden');
  showAuthTab(form);
}

// Check for magic link on load
function checkMagicLink() {
  if (isSignInWithEmailLink(auth, window.location.href)) {
    const saved = localStorage.getItem('generatorEmailForSignIn');
    if (saved) {
      signInWithEmailLink(auth, saved, window.location.href)
        .then(() => localStorage.removeItem('generatorEmailForSignIn'))
        .catch(err => {
          document.getElementById('auth-magic-confirm').style.display = 'block';
          document.getElementById('auth-signin-form').style.display = 'none';
          document.getElementById('auth-magic-form').style.display = 'none';
        });
    } else {
      // Need to ask for email
      document.getElementById('auth-magic-confirm').style.display = 'block';
      document.getElementById('auth-signin-form').style.display = 'none';
      document.getElementById('auth-magic-form').style.display = 'none';
    }
  }
}

// =====================
// AUTH BUTTON LISTENERS
// =====================
document.getElementById('btn-signin').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  hideAuthError('auth-error');

  if (!email || !password) {
    showAuthError('auth-error', 'Please enter your email and password.');
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    showAuthError('auth-error', getAuthErrorMessage(err.code));
  }
});

document.getElementById('btn-magic-link').addEventListener('click', async () => {
  const email = document.getElementById('magic-email').value.trim();
  hideAuthError('magic-error');

  if (!email) {
    showAuthError('magic-error', 'Please enter your email address.');
    return;
  }

  try {
    await sendSignInLinkToEmail(auth, email, {
      url: window.location.origin,
      handleCodeInApp: true
    });
    localStorage.setItem('generatorEmailForSignIn', email);
    document.getElementById('auth-magic-form').style.display = 'none';
    document.getElementById('auth-magic-sent').style.display = 'block';
  } catch (err) {
    showAuthError('magic-error', getAuthErrorMessage(err.code));
  }
});

document.getElementById('btn-magic-confirm').addEventListener('click', async () => {
  const email = document.getElementById('magic-confirm-email').value.trim();
  hideAuthError('magic-confirm-error');

  if (!email) {
    showAuthError('magic-confirm-error', 'Please enter your email address.');
    return;
  }

  try {
    await signInWithEmailLink(auth, email, window.location.href);
    localStorage.removeItem('generatorEmailForSignIn');
  } catch (err) {
    showAuthError('magic-confirm-error', getAuthErrorMessage(err.code));
  }
});

document.getElementById('btn-forgot-password').addEventListener('click', async () => {
  const email = document.getElementById('auth-email').value.trim();
  hideAuthError('auth-error');

  if (!email) {
    showAuthError('auth-error', 'Please enter your email address first.');
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showAuthError('auth-error', '✅ Password reset email sent. Check your inbox.');
    document.getElementById('auth-error').style.background = '#f0fdf4';
    document.getElementById('auth-error').style.borderColor = '#86efac';
    document.getElementById('auth-error').style.color = '#166534';
  } catch (err) {
    showAuthError('auth-error', getAuthErrorMessage(err.code));
  }
});

document.getElementById('btn-back-to-signin').addEventListener('click', () => {
  showAuthTab('signin');
});

// =====================
// UPDATE onAuthStateChanged
// =====================
// Replace the existing onAuthStateChanged block at the top of this file with this:
onAuthStateChanged(auth, (user) => {
  syncUser = user;
  if (user) {
    showMainApp();
  } else {
    checkMagicLink();
    showAuthScreen();
  }
  const btn = document.getElementById('importFromKeeper');
  if (btn) {
    btn.textContent = 'Import from Record Keeper';
  }
});

// Main planner logic

let currentPlan = {
    studentName:    'Student',
    schoolName:     'HomeschoolHS',
    graduationYear: new Date().getFullYear() + 4,
    studentDOB:     '',
    studentAddress: '',
    schoolAddress:  '',
    schoolPhone:    '',
    schoolEmail:    '',
    schoolWebsite:  '',
    schoolLogo:     '',  // stays in localStorage — not synced to Firestore
    courses: {
        8:  [],
        9:  [],
        10: [],
        11: [],
        12: []
    },
    exams: []
};

let courseBeingAdded = null;

// =====================
// INIT
// DOMContentLoaded wires up UI only.
// Data load happens after Firestore signals ready via onFirestoreReady().
// =====================
document.addEventListener('DOMContentLoaded', function() {
    populateGraduationYears();
    setupEventListeners();
    updateUI();

    // Restore logo from localStorage (logo is not stored in Firestore)
    const savedLogo = localStorage.getItem('transcript_school_logo');
    if (savedLogo) {
        currentPlan.schoolLogo = savedLogo;
        document.getElementById('logoPreview').innerHTML =
            `<img src="${savedLogo}" style="height:60px;border-radius:4px;">`;
    }
});

// =====================
// FIRESTORE READY CALLBACK
// Called by firestore.js once auth resolves and transcriptId is set.
// This is the entry point for all data loading.
// =====================
window.onFirestoreReady = async function() {
    try {
        const data = await window.fsLoadTranscriptData(window.currentUid, window.transcriptId);
        applyLoadedData(data);
        updateUI();
    } catch (err) {
        console.error('Failed to load transcript data:', err);
        alert('⚠️ Could not load your saved data. Check your connection and refresh.');
    }
};

// =====================
// APPLY LOADED DATA
// Maps Firestore response into currentPlan.
// =====================
function applyLoadedData(data) {
    const { meta, courses, exams } = data;

    // Student + school info
    if (meta.studentName)    currentPlan.studentName    = meta.studentName;
    if (meta.schoolName)     currentPlan.schoolName     = meta.schoolName;
    if (meta.graduationYear) currentPlan.graduationYear = meta.graduationYear;
    if (meta.studentDOB)     currentPlan.studentDOB     = meta.studentDOB;
    if (meta.studentAddress) currentPlan.studentAddress = meta.studentAddress;
    if (meta.schoolAddress)  currentPlan.schoolAddress  = meta.schoolAddress;
    if (meta.schoolPhone)    currentPlan.schoolPhone    = meta.schoolPhone;
    if (meta.schoolEmail)    currentPlan.schoolEmail    = meta.schoolEmail;
    if (meta.schoolWebsite)  currentPlan.schoolWebsite  = meta.schoolWebsite;

    // Courses — ensure all year keys exist
    CONFIG.YEARS.forEach(year => {
        currentPlan.courses[year.number] = courses[year.number] || [];
    });

    // Exams
    currentPlan.exams = exams || [];
}

// =====================
// GRADUATION YEAR DROPDOWN
// =====================
function populateGraduationYears() {
    const select = document.getElementById('graduationYear');
    for (let year = CONFIG.GRAD_YEAR_MAX; year >= CONFIG.GRAD_YEAR_MIN; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    }
}

// =====================
// EVENT LISTENERS
// =====================
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // Student info — update currentPlan on change (save still requires button)
    document.getElementById('studentName').addEventListener('change', function() {
        currentPlan.studentName = this.value;
        updateUI();
    });
    document.getElementById('schoolName').addEventListener('change', function() {
        currentPlan.schoolName = this.value;
        updateUI();
    });
    document.getElementById('graduationYear').addEventListener('change', function() {
        currentPlan.graduationYear = parseInt(this.value);
        updateUI();
    });
    document.getElementById('studentDOB').addEventListener('change', function() {
        currentPlan.studentDOB = this.value;
    });
    document.getElementById('studentAddress').addEventListener('change', function() {
        currentPlan.studentAddress = this.value;
    });
    document.getElementById('schoolAddress').addEventListener('change', function() {
        currentPlan.schoolAddress = this.value;
    });
    document.getElementById('schoolPhone').addEventListener('change', function() {
        currentPlan.schoolPhone = this.value;
    });
    document.getElementById('schoolEmail').addEventListener('change', function() {
        currentPlan.schoolEmail = this.value;
    });
    document.getElementById('schoolWebsite').addEventListener('change', function() {
        currentPlan.schoolWebsite = this.value;
    });

    // Logo — stays in localStorage only
    document.getElementById('schoolLogo').addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            currentPlan.schoolLogo = e.target.result;
            localStorage.setItem('transcript_school_logo', e.target.result);
            document.getElementById('logoPreview').innerHTML =
                `<img src="${e.target.result}" style="height:60px;border-radius:4px;">`;
        };
        reader.readAsDataURL(file);
    });

    // Exam form submission
    document.getElementById('examForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitExam();
    });

    // File input for JSON import
    document.getElementById('fileInput').addEventListener('change', function(e) {
        handleFileImport(e);
    });
}

// =====================
// TAB SWITCHING
// =====================
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('active');
}

// =====================
// COURSE MODAL — ADD
// =====================
function addCourse(year) {
    courseBeingAdded = year;
    document.getElementById('courseForm').reset();
    delete document.getElementById('courseForm').dataset.editId;
    document.getElementById('courseModalTitle').textContent = 'Add Course';
    document.getElementById('courseSubmitBtn').textContent = 'Add Course';
    document.getElementById('courseModal').classList.add('show');
}

function closeModal() {
    document.getElementById('courseModal').classList.remove('show');
    courseBeingAdded = null;
}

// =====================
// COURSE SUBMISSION (add + edit)
// Wired to form submit — handles both add and edit modes.
// Writes to Firestore immediately on each action.
// UUID conversion happens here: any numeric (timestamp) ID becomes a UUID.
// =====================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('courseForm').addEventListener('submit', async function(e) {
        e.preventDefault();

        if (!window.firestoreReady) {
            alert('Still connecting — please try again in a moment.');
            return;
        }

        const courseName    = document.getElementById('courseName').value.trim();
        const courseCredits = parseFloat(document.getElementById('courseCredits').value);
        const courseGrade   = document.getElementById('courseGrade').value;
        const courseType    = document.getElementById('courseType').value;
        const courseSubject = document.getElementById('courseSubject').value;

        if (!courseName || !courseGrade || !courseSubject) {
            alert('Please fill in all fields.');
            return;
        }

        const editId  = this.dataset.editId;
        const year    = courseBeingAdded;

        if (editId) {
            // ── EDIT existing course ──
            const idx = currentPlan.courses[year].findIndex(c => String(c.id) === String(editId));
            if (idx > -1) {
                const existing = currentPlan.courses[year][idx];
                // Ensure stable UUID — convert timestamp IDs on edit
                const stableId = isTimestampId(existing.id) ? crypto.randomUUID() : existing.id;
                const updated = {
                    id:        stableId,
                    name:      courseName,
                    credits:   courseCredits,
                    grade:     courseGrade,
                    type:      courseType,
                    subject:   courseSubject,
                    gpaPoints: getGPAPoints(courseGrade, courseType),
                    year:      year,
                    createdAt: existing.createdAt || null
                };
                currentPlan.courses[year][idx] = updated;
                try {
                    // If ID changed, delete old doc first
                    if (String(stableId) !== String(existing.id)) {
                        await window.fsDeleteCourse(window.currentUid, window.transcriptId, existing.id);
                    }
                    await window.fsSaveCourse(window.currentUid, window.transcriptId, updated);
                } catch (err) {
                    console.error('Failed to save course:', err);
                    alert('⚠️ Course updated locally but could not save to cloud. Check your connection.');
                }
            }
            delete this.dataset.editId;
        } else {
            // ── ADD new course ──
            const course = {
                id:        crypto.randomUUID(),
                name:      courseName,
                credits:   courseCredits,
                grade:     courseGrade,
                type:      courseType,
                subject:   courseSubject,
                gpaPoints: getGPAPoints(courseGrade, courseType),
                year:      year,
                createdAt: null  // serverTimestamp set in fsSaveCourse
            };
            currentPlan.courses[year].push(course);
            try {
                await window.fsSaveCourse(window.currentUid, window.transcriptId, course);
            } catch (err) {
                console.error('Failed to save course:', err);
                alert('⚠️ Course added locally but could not save to cloud. Check your connection.');
            }
        }

        closeModal();
        updateUI();
    });
});

// =====================
// COURSE — DELETE WITH UNDO
// Deletes from Firestore after undo window expires.
// If undone before timer fires, cancels the Firestore delete.
// =====================
let lastDeletedCourse = null;
let undoFirestoreTimer = null;

function deleteCourse(year, courseId) {
    const course = currentPlan.courses[year].find(c => String(c.id) === String(courseId));
    if (!course) return;

    lastDeletedCourse = { year, course };
    currentPlan.courses[year] = currentPlan.courses[year].filter(c => String(c.id) !== String(courseId));
    updateUI();

    const banner = document.getElementById('undoBanner');
    banner.style.display = 'flex';
    clearTimeout(window.undoTimer);
    clearTimeout(undoFirestoreTimer);

    // Give 6s to undo before committing delete to Firestore
    window.undoTimer = setTimeout(() => {
        banner.style.display = 'none';
    }, 6000);

    undoFirestoreTimer = setTimeout(async () => {
        if (!lastDeletedCourse) return; // was undone
        try {
            await window.fsDeleteCourse(window.currentUid, window.transcriptId, courseId);
        } catch (err) {
            console.error('Failed to delete course from Firestore:', err);
        }
        lastDeletedCourse = null;
    }, 6000);
}

function undoDelete() {
    if (!lastDeletedCourse) return;
    // Cancel the pending Firestore delete
    clearTimeout(undoFirestoreTimer);
    currentPlan.courses[lastDeletedCourse.year].push(lastDeletedCourse.course);
    lastDeletedCourse = null;
    document.getElementById('undoBanner').style.display = 'none';
    clearTimeout(window.undoTimer);
    updateUI();
}

// =====================
// COURSE — EDIT (opens modal)
// =====================
function editCourse(year, courseId) {
    const course = currentPlan.courses[year].find(c => String(c.id) === String(courseId));
    if (!course) return;

    courseBeingAdded = year;
    document.getElementById('courseName').value    = course.name;
    document.getElementById('courseCredits').value = course.credits;
    document.getElementById('courseGrade').value   = course.grade;
    document.getElementById('courseType').value    = course.type;
    document.getElementById('courseSubject').value = course.subject || '';

    document.getElementById('courseForm').dataset.editId = course.id;
    document.getElementById('courseModalTitle').textContent = 'Edit Course';
    document.getElementById('courseSubmitBtn').textContent = 'Save Changes';
    document.getElementById('courseModal').classList.add('show');
}

// =====================
// EXAM SUBMISSION (add + edit)
// Writes to Firestore immediately.
// =====================
async function submitExam() {
    if (!window.firestoreReady) {
        alert('Still connecting — please try again in a moment.');
        return;
    }

    const examName  = document.getElementById('examName').value.trim();
    const examDate  = document.getElementById('examDate').value.trim();
    const examScore = document.getElementById('examScore').value.trim();

    if (!examName || !examScore) {
        alert('Please enter at least the exam name and score.');
        return;
    }

    const editId = document.getElementById('examForm').dataset.editId;

    if (editId) {
        const idx = currentPlan.exams.findIndex(e => String(e.id) === String(editId));
        if (idx > -1) {
            const updated = {
                id:    currentPlan.exams[idx].id,
                name:  examName,
                date:  examDate,
                score: examScore
            };
            currentPlan.exams[idx] = updated;
            try {
                await window.fsSaveExam(window.currentUid, window.transcriptId, updated);
            } catch (err) {
                console.error('Failed to save exam:', err);
                alert('⚠️ Exam updated locally but could not save to cloud. Check your connection.');
            }
        }
        delete document.getElementById('examForm').dataset.editId;
    } else {
        const exam = {
            id:    crypto.randomUUID(),
            name:  examName,
            date:  examDate,
            score: examScore
        };
        currentPlan.exams.push(exam);
        try {
            await window.fsSaveExam(window.currentUid, window.transcriptId, exam);
        } catch (err) {
            console.error('Failed to save exam:', err);
            alert('⚠️ Exam added locally but could not save to cloud. Check your connection.');
        }
    }

    closeExamModal();
    updateUI();
}

// =====================
// EXAM — DELETE
// =====================
async function deleteExam(examId) {
    currentPlan.exams = currentPlan.exams.filter(e => String(e.id) !== String(examId));
    updateUI();
    try {
        await window.fsDeleteExam(window.currentUid, window.transcriptId, examId);
    } catch (err) {
        console.error('Failed to delete exam:', err);
    }
}

// =====================
// EXAM — EDIT (opens modal)
// =====================
function editExam(examId) {
    const exam = currentPlan.exams.find(e => String(e.id) === String(examId));
    if (!exam) return;

    document.getElementById('examName').value  = exam.name;
    document.getElementById('examDate').value  = exam.date  || '';
    document.getElementById('examScore').value = exam.score || '';

    document.getElementById('examForm').dataset.editId = examId;
    document.getElementById('examModal').classList.add('show');
}

function addExam() {
    document.getElementById('examForm').reset();
    delete document.getElementById('examForm').dataset.editId;
    document.getElementById('examModal').classList.add('show');
}

function closeExamModal() {
    document.getElementById('examModal').classList.remove('show');
    delete document.getElementById('examForm').dataset.editId;
}

// =====================
// SAVE PLAN
// Saves student + school meta to Firestore.
// Also converts any remaining timestamp IDs to UUIDs (post-Keeper-import).
// Courses and exams are saved immediately on add/edit/delete —
// this button handles meta fields + the UUID conversion safety net.
// =====================
async function savePlan() {
    if (!window.firestoreReady) {
        alert('Still connecting — please try again in a moment.');
        return;
    }

    // UUID conversion: replace any numeric timestamp IDs with stable UUIDs
    let conversionsNeeded = false;
    for (const year of CONFIG.YEARS) {
        for (let i = 0; i < currentPlan.courses[year.number].length; i++) {
            const course = currentPlan.courses[year.number][i];
            if (isTimestampId(course.id)) {
                const oldId  = course.id;
                const newId  = crypto.randomUUID();
                course.id    = newId;
                conversionsNeeded = true;
                // Delete old doc, write new one
                try {
                    await window.fsDeleteCourse(window.currentUid, window.transcriptId, oldId);
                    await window.fsSaveCourse(window.currentUid, window.transcriptId, course);
                } catch (err) {
                    console.error('ID conversion failed for course:', course.name, err);
                }
            }
        }
    }

    // Save transcript meta
    try {
        await window.fsSaveTranscriptMeta(window.currentUid, window.transcriptId, currentPlan);
        if (conversionsNeeded) {
            alert(`✅ Plan saved for ${currentPlan.studentName}.\n\nImported courses have been finalized and are ready for the Course Description Builder.`);
        } else {
            alert(`✅ Plan saved for ${currentPlan.studentName}.`);
        }
    } catch (err) {
        console.error('Failed to save plan:', err);
        alert('⚠️ Could not save to cloud. Check your connection and try again.');
    }
}

// =====================
// SAVE SCHOOL INFO
// Explicit save for settings tab school fields.
// =====================
async function saveSchoolInfo() {
    if (!window.firestoreReady) {
        alert('Still connecting — please try again in a moment.');
        return;
    }

    currentPlan.schoolAddress = document.getElementById('schoolAddress').value;
    currentPlan.schoolPhone   = document.getElementById('schoolPhone').value;
    currentPlan.schoolEmail   = document.getElementById('schoolEmail').value;
    currentPlan.schoolWebsite = document.getElementById('schoolWebsite').value;

    try {
        await window.fsSaveTranscriptMeta(window.currentUid, window.transcriptId, currentPlan);
        const msg = document.getElementById('schoolInfoSaved');
        msg.style.display = 'inline';
        setTimeout(() => msg.style.display = 'none', 3000);
    } catch (err) {
        console.error('Failed to save school info:', err);
        alert('⚠️ Could not save to cloud. Check your connection and try again.');
    }
}

// =====================
// EXPORT / IMPORT (JSON) — unchanged, works on currentPlan in memory
// =====================
function exportPlan() {
    const dataStr  = JSON.stringify(currentPlan, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url      = URL.createObjectURL(dataBlob);
    const link     = document.createElement('a');
    link.href      = url;
    link.download  = `${currentPlan.studentName}_plan.json`;
    link.click();
    URL.revokeObjectURL(url);
}

function importPlan() {
    document.getElementById('fileInput').click();
}

async function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(event) {
        try {
            const imported = JSON.parse(event.target.result);
            currentPlan = imported;
            // Ensure all year keys exist
            CONFIG.YEARS.forEach(year => {
                if (!currentPlan.courses[year.number]) currentPlan.courses[year.number] = [];
            });
            if (!currentPlan.exams) currentPlan.exams = [];
            updateUI();
            // Trigger a full save to push imported data to Firestore
            await savePlan();
            alert('✅ Plan imported successfully.');
        } catch (error) {
            alert('❌ Error importing plan: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// =====================
// CLEAR ALL
// Removes all courses from Firestore and clears currentPlan.
// =====================
async function clearPlan() {
    if (!confirm('Are you sure you want to clear all courses? This cannot be undone.')) return;

    if (!window.firestoreReady) {
        alert('Still connecting — please try again in a moment.');
        return;
    }

    const deletePromises = [];
    CONFIG.YEARS.forEach(year => {
        (currentPlan.courses[year.number] || []).forEach(course => {
            deletePromises.push(
                window.fsDeleteCourse(window.currentUid, window.transcriptId, course.id)
            );
        });
        currentPlan.courses[year.number] = [];
    });

    currentPlan.exams.forEach(exam => {
        deletePromises.push(
            window.fsDeleteExam(window.currentUid, window.transcriptId, exam.id)
        );
    });
    currentPlan.exams = [];

    try {
        await Promise.all(deletePromises);
    } catch (err) {
        console.error('Failed to clear some courses from Firestore:', err);
    }

    updateUI();
}

// =====================
// UPDATE UI
// =====================
function updateUI() {
    document.getElementById('studentName').value    = currentPlan.studentName    || '';
    document.getElementById('schoolName').value     = currentPlan.schoolName     || '';
    document.getElementById('graduationYear').value = currentPlan.graduationYear || '';
    document.getElementById('studentDOB').value     = currentPlan.studentDOB     || '';
    document.getElementById('studentAddress').value = currentPlan.studentAddress || '';
    document.getElementById('schoolAddress').value  = currentPlan.schoolAddress  || '';
    document.getElementById('schoolPhone').value    = currentPlan.schoolPhone    || '';
    document.getElementById('schoolEmail').value    = currentPlan.schoolEmail    || '';
    document.getElementById('schoolWebsite').value  = currentPlan.schoolWebsite  || '';

    CONFIG.YEARS.forEach(year => renderYear(year.number));
    renderExams();
    updateSummary();
}

// =====================
// RENDER YEAR
// =====================
function renderYear(year) {
    const coursesList = document.getElementById(`year-${year}`);
    if (!coursesList) return;
    const courses = currentPlan.courses[year] || [];

    coursesList.innerHTML = '';
    courses.forEach(course => {
        const courseEl = document.createElement('div');
        courseEl.className = 'course-item';
        courseEl.innerHTML = `
            <div class="course-info">
                <div class="course-name">${course.name}</div>
                <div class="course-details">${course.type} &bull; ${course.credits} credits${course.subject ? ' &bull; ' + course.subject : ''}</div>
            </div>
            <span class="course-grade">${course.grade}</span>
            <button class="course-edit" onclick="editCourse(${year}, '${course.id}')">Edit</button>
            <button class="course-delete" onclick="deleteCourse(${year}, '${course.id}')">Delete</button>
        `;
        coursesList.appendChild(courseEl);
    });
}

// =====================
// RENDER EXAMS
// =====================
function renderExams() {
    const examsList = document.getElementById('exams-list');
    if (!examsList) return;

    examsList.innerHTML = '';
    (currentPlan.exams || []).forEach(exam => {
        const examEl = document.createElement('div');
        examEl.className = 'course-item';
        examEl.innerHTML = `
            <div class="course-info">
                <div class="course-name">${exam.name}</div>
                <div class="course-details">${exam.date || 'No date'}</div>
            </div>
            <span class="course-grade">${exam.score}</span>
            <button class="course-edit" onclick="editExam('${exam.id}')">Edit</button>
            <button class="course-delete" onclick="deleteExam('${exam.id}')">Delete</button>
        `;
        examsList.appendChild(examEl);
    });
}

// =====================
// SUMMARY STATS
// =====================
function updateSummary() {
    let totalCredits = 0, totalGPAPoints = 0, courseCount = 0, gradedCourseCount = 0;

    CONFIG.YEARS.forEach(year => {
        (currentPlan.courses[year.number] || []).forEach(course => {
            courseCount++;
            totalCredits += course.credits;
            if (course.gpaPoints !== null) {
                totalGPAPoints    += course.gpaPoints * course.credits;
                gradedCourseCount += course.credits;
            }
        });
    });

    const gpa = gradedCourseCount > 0 ? totalGPAPoints / gradedCourseCount : 0;
    document.getElementById('totalCredits').textContent = totalCredits.toFixed(1);
    document.getElementById('overallGPA').textContent   = formatGPA(gpa);
    document.getElementById('totalCourses').textContent = courseCount;
}

// =====================
// UTILITY: detect timestamp-style IDs (numeric, from Date.now())
// UUIDs are strings with hyphens; timestamp IDs are numeric or numeric strings.
// =====================
function isTimestampId(id) {
    return /^\d+$/.test(String(id));
}

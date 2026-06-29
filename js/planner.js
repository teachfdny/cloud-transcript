// Main planner logic

let currentPlan = {
    studentName: 'Student',
    schoolName: 'HomeschoolHS',
    graduationYear: new Date().getFullYear() + 4,
    studentDOB: '',
    studentAddress: '',
    schoolAddress: '',
    schoolPhone: '',
    schoolEmail: '',
    schoolWebsite: '',
    schoolLogo: '',
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    populateGraduationYears();
    setupEventListeners();
    loadPlan();
    updateUI();
    checkBackupWarning();
});

// Populate graduation year dropdown
function populateGraduationYears() {
    const select = document.getElementById('graduationYear');
    for (let year = CONFIG.GRAD_YEAR_MAX; year >= CONFIG.GRAD_YEAR_MIN; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        select.appendChild(option);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });

    // Student info changes
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

    document.getElementById('schoolLogo').addEventListener('change', function() {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            currentPlan.schoolLogo = e.target.result;
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

    // File input for import
    document.getElementById('fileInput').addEventListener('change', function(e) {
        handleFileImport(e);
    });
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Add active to selected button
    event.target.classList.add('active');
}

// Add course modal
function addCourse(year) {
    courseBeingAdded = year;
    document.getElementById('courseForm').reset();
    document.getElementById('courseModal').classList.add('show');
}

// Close modal
function closeModal() {
    document.getElementById('courseModal').classList.remove('show');
    courseBeingAdded = null;
}

// Submit course
function submitCourse() {
    const courseName    = document.getElementById('courseName').value.trim();
    const courseCredits = parseFloat(document.getElementById('courseCredits').value);
    const courseGrade   = document.getElementById('courseGrade').value;
    const courseType    = document.getElementById('courseType').value;

    if (!courseName || !courseGrade) {
        alert('Please fill in all fields');
        return;
    }

    const course = {
        id:        Date.now(),
        name:      courseName,
        credits:   courseCredits,
        grade:     courseGrade,
        type:      courseType,
        gpaPoints: getGPAPoints(courseGrade, courseType)
    };

    currentPlan.courses[courseBeingAdded].push(course);
    closeModal();
    updateUI();
}

// Delete course with undo
let lastDeletedCourse = null;

function deleteCourse(year, courseId) {
    const course = currentPlan.courses[year].find(c => c.id === courseId);
    if (!course) return;

    lastDeletedCourse = { year, course };
    currentPlan.courses[year] = currentPlan.courses[year].filter(c => c.id !== courseId);
    updateUI();

    // show undo banner
    const banner = document.getElementById('undoBanner');
    banner.style.display = 'flex';
    clearTimeout(window.undoTimer);
    window.undoTimer = setTimeout(() => {
        banner.style.display = 'none';
        lastDeletedCourse = null;
    }, 6000);
}

function undoDelete() {
    if (!lastDeletedCourse) return;
    currentPlan.courses[lastDeletedCourse.year].push(lastDeletedCourse.course);
    lastDeletedCourse = null;
    document.getElementById('undoBanner').style.display = 'none';
    clearTimeout(window.undoTimer);
    updateUI();
}

// Edit course
function editCourse(year, courseId) {
    const course = currentPlan.courses[year].find(c => c.id === courseId);
    if (!course) return;

    courseBeingAdded = year;
    document.getElementById('courseName').value    = course.name;
    document.getElementById('courseCredits').value = course.credits;
    document.getElementById('courseGrade').value   = course.grade;
    document.getElementById('courseType').value    = course.type;

    // mark as edit so submitCourse knows to update instead of add
    document.getElementById('courseForm').dataset.editId = courseId;
    document.getElementById('courseModal').classList.add('show');
}

// Update submitCourse to handle edits
// Replace the push line at the end of submitCourse with this full version:
// (already handled above — but update the modal title too)
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('courseForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const editId = this.dataset.editId;
        if (editId) {
            // editing existing course
            const year = courseBeingAdded;
            const idx  = currentPlan.courses[year].findIndex(c => c.id === parseInt(editId));
            if (idx > -1) {
                currentPlan.courses[year][idx] = {
                    id:        parseInt(editId),
                    name:      document.getElementById('courseName').value.trim(),
                    credits:   parseFloat(document.getElementById('courseCredits').value),
                    grade:     document.getElementById('courseGrade').value,
                    type:      document.getElementById('courseType').value,
                    gpaPoints: getGPAPoints(
                        document.getElementById('courseGrade').value,
                        document.getElementById('courseType').value
                    )
                };
            }
            delete this.dataset.editId;
            closeModal();
            updateUI();
        } else {
            submitCourse();
        }
    });
});

// Submit exam

function submitExam() {
    const examName  = document.getElementById('examName').value.trim();
    const examDate  = document.getElementById('examDate').value.trim();
    const examScore = document.getElementById('examScore').value.trim();

    if (!examName || !examScore) {
        alert('Please enter at least the exam name and score');
        return;
    }

    const editId = document.getElementById('examForm').dataset.editId;

    if (editId) {
        const idx = currentPlan.exams.findIndex(e => e.id === parseInt(editId));
        if (idx > -1) {
            currentPlan.exams[idx] = {
                id:    parseInt(editId),
                name:  examName,
                date:  examDate,
                score: examScore
            };
        }
        delete document.getElementById('examForm').dataset.editId;
    } else {
        currentPlan.exams.push({
            id:    Date.now(),
            name:  examName,
            date:  examDate,
            score: examScore
        });
    }

    closeExamModal();
    updateUI();
}

// Delete exam
function deleteExam(examId) {
    currentPlan.exams = currentPlan.exams.filter(e => e.id !== examId);
    updateUI();
}

// Edit exam
function editExam(examId) {
    const exam = currentPlan.exams.find(e => e.id === examId);
    if (!exam) return;

    document.getElementById('examName').value  = exam.name;
    document.getElementById('examDate').value  = exam.date  || '';
    document.getElementById('examScore').value = exam.score || '';

    document.getElementById('examForm').dataset.editId = examId;
    document.getElementById('examModal').classList.add('show');
}

// Open/close exam modal
function addExam() {
    document.getElementById('examForm').reset();
    delete document.getElementById('examForm').dataset.editId;
    document.getElementById('examModal').classList.add('show');
}

function closeExamModal() {
    document.getElementById('examModal').classList.remove('show');
    delete document.getElementById('examForm').dataset.editId;
}

// Update UI with current plan
function updateUI() {
    // Update student info
    document.getElementById('studentName').value    = currentPlan.studentName;
    document.getElementById('schoolName').value     = currentPlan.schoolName;
    document.getElementById('graduationYear').value = currentPlan.graduationYear;
    document.getElementById('studentDOB').value     = currentPlan.studentDOB     || '';
    document.getElementById('studentAddress').value = currentPlan.studentAddress || '';
    document.getElementById('schoolAddress').value  = currentPlan.schoolAddress  || '';
    document.getElementById('schoolPhone').value    = currentPlan.schoolPhone    || '';
    document.getElementById('schoolEmail').value    = currentPlan.schoolEmail    || '';
    document.getElementById('schoolWebsite').value  = currentPlan.schoolWebsite  || '';

    // Update years
    CONFIG.YEARS.forEach(year => {
        renderYear(year.number);
    });

    // Update exams
    renderExams();

    // Update summary
    updateSummary();
}

// Render a year's courses
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
                <div class="course-details">${course.type} &bull; ${course.credits} credits</div>
            </div>
            <span class="course-grade">${course.grade}</span>
            <button class="course-edit" onclick="editCourse(${year}, ${course.id})">Edit</button>
            <button class="course-delete" onclick="deleteCourse(${year}, ${course.id})">Delete</button>
        `;
        coursesList.appendChild(courseEl);
    });
}

// Render exam scores
function renderExams() {
    const examsList = document.getElementById('exams-list');
    if (!examsList) return;
    const exams = currentPlan.exams || [];

    examsList.innerHTML = '';

    exams.forEach(exam => {
        const examEl = document.createElement('div');
        examEl.className = 'course-item';
        examEl.innerHTML = `
            <div class="course-info">
                <div class="course-name">${exam.name}</div>
                <div class="course-details">${exam.date || 'No date'}</div>
            </div>
            <span class="course-grade">${exam.score}</span>
          <button class="course-edit" onclick="editExam(${exam.id})">Edit</button>
            <button class="course-delete" onclick="deleteExam(${exam.id})">Delete</button>
        `;
        examsList.appendChild(examEl);
    });
}

// Update summary statistics
function updateSummary() {
    let totalCredits = 0;
    let totalGPAPoints = 0;
    let courseCount = 0;
    let gradedCourseCount = 0;

    CONFIG.YEARS.forEach(year => {
        const courses = currentPlan.courses[year.number] || [];
        courses.forEach(course => {
            courseCount++;
            totalCredits += course.credits;
            
            if (course.gpaPoints !== null) {
                totalGPAPoints += course.gpaPoints * course.credits;
                gradedCourseCount += course.credits;
            }
        });
    });

    const gpa = gradedCourseCount > 0 ? totalGPAPoints / gradedCourseCount : 0;

    document.getElementById('totalCredits').textContent = totalCredits.toFixed(1);
    document.getElementById('overallGPA').textContent = formatGPA(gpa);
    document.getElementById('totalCourses').textContent = courseCount;
}

// Save plan to localStorage
function savePlan() {
    const key = getPlanKey();
    localStorage.setItem(key, JSON.stringify(currentPlan));
    alert(`✅ Plan saved for ${currentPlan.studentName}`);
}

// Load plan from localStorage
function loadPlan() {
    const saved = localStorage.getItem(getPlanKey());
    if (saved) {
        const loaded = JSON.parse(saved);
        currentPlan = { ...currentPlan, ...loaded };
        // ensure all year keys exist in case plan was saved before 8th grade was added
        CONFIG.YEARS.forEach(year => {
            if (!currentPlan.courses[year.number]) {
                currentPlan.courses[year.number] = [];
            }
        });
        // ensure exams array exists
        if (!currentPlan.exams) {
            currentPlan.exams = [];
        }
    }
}
// Export plan as JSON
function exportPlan() {
    const dataStr = JSON.stringify(currentPlan, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${currentPlan.studentName}_plan.json`;
    link.click();
    URL.revokeObjectURL(url);
}

// Import plan from JSON
function importPlan() {
    document.getElementById('fileInput').click();
}

// Handle file import
function handleFileImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const imported = JSON.parse(event.target.result);
            currentPlan = imported;
            savePlan();
            updateUI();
            alert('✅ Plan imported successfully');
        } catch (error) {
            alert('❌ Error importing plan: ' + error.message);
        }
    };
    reader.readAsText(file);
}

// Clear all data
function clearPlan() {
    if (confirm('Are you sure you want to clear all courses? This cannot be undone.')) {
        CONFIG.YEARS.forEach(year => {
            currentPlan.courses[year.number] = [];
        });
        updateUI();
    }
}
// Save school information
function saveSchoolInfo() {
    currentPlan.schoolAddress = document.getElementById('schoolAddress').value;
    currentPlan.schoolPhone = document.getElementById('schoolPhone').value;
    currentPlan.schoolEmail = document.getElementById('schoolEmail').value;
    currentPlan.schoolWebsite = document.getElementById('schoolWebsite').value;

    const key = getPlanKey();
    localStorage.setItem(key, JSON.stringify(currentPlan));

    const msg = document.getElementById('schoolInfoSaved');
    msg.style.display = 'inline';
    setTimeout(() => msg.style.display = 'none', 3000);
}
function dismissBackupWarning() {
    document.getElementById('backupWarning').style.display = 'none';
    localStorage.setItem('backupWarningDismissed', 'true');
}

function checkBackupWarning() {
    if (localStorage.getItem('backupWarningDismissed') === 'true') {
        document.getElementById('backupWarning').style.display = 'none';
    }
}

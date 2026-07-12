// ============================================================
//  TRANSCRIPT GENERATOR — 2-up layout matching reference design
// ============================================================

function generateTranscript() {
    const output = document.getElementById('transcriptOutput');

    const hasCoursesOrExams =
        Object.values(currentPlan.courses).some(year => year.length > 0) ||
        (currentPlan.exams && currentPlan.exams.length > 0);

    if (!hasCoursesOrExams) {
        output.innerHTML = `
            <div class="empty-transcript">
                <h3>No Courses Added</h3>
                <p>Please add courses in the Planner tab first.</p>
            </div>`;
        return;
    }

    const overallStats  = calculateOverallStats();
    const today         = new Date();
    const issuedDate    = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const schoolAddress = currentPlan.schoolAddress || '';
    const schoolPhone   = currentPlan.schoolPhone   || '';
    const schoolEmail   = currentPlan.schoolEmail   || '';
    const schoolWebsite = currentPlan.schoolWebsite || '';

    const studentDOB = currentPlan.studentDOB
        ? new Date(currentPlan.studentDOB + 'T00:00:00').toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : '________________';

    // school meta line
    const schoolMetaParts = [schoolAddress, schoolPhone, schoolEmail, schoolWebsite].filter(Boolean);
    const schoolMeta = schoolMetaParts.join(' &nbsp;&bull;&nbsp; ');

    // certification year range
    const gradYear  = parseInt(currentPlan.graduationYear) || new Date().getFullYear();
    const startYear = gradYear - 4;
    const certLine  = `I self-certify and affirm that this is the official transcript and record of ${currentPlan.studentName || 'the student'}'s academic studies from ${startYear} \u2013 ${gradYear}.`;

    // ── Helper: build one course year panel ───────────────────
    function buildYearPanel(yearObj) {
        const courses = currentPlan.courses[yearObj.number] || [];
        if (courses.length === 0) return '<div class="pt-year-panel pt-year-empty"></div>';

        const stats = calculateYearStats(courses);

        const gradeOffset = { 8: 5, 9: 4, 10: 3, 11: 2, 12: 1 };
        const offset      = gradeOffset[yearObj.number] ?? 0;
        const sy          = gradYear - offset;
        const yearLabel   = `${sy} \u2013 ${sy + 1}`;

        let rows = '';
        courses.forEach(course => {
            const typeTag = course.type === 'Honors'          ? '<sup>H</sup>'
                          : course.type === 'AP'              ? '<sup>AP</sup>'
                          : course.type === 'Dual Enrollment' ? '<sup>DE</sup>'
                          : course.type === 'IB'              ? '<sup>IB</sup>'
                          : '';
            rows += `
                <tr>
                    <td class="pt-col-name">${course.name}${typeTag}</td>
                    <td class="pt-col-credits">${course.credits}</td>
                    <td class="pt-col-grade">${course.grade}</td>
                </tr>`;
        });

        return `
            <div class="pt-year-panel">
                <table class="pt-year-table">
                    <thead>
                        <tr class="pt-year-header-row">
                            <th class="pt-yh-name">${yearObj.label || yearObj.name}</th>
                            <th class="pt-yh-year" colspan="2">${yearLabel}</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr class="pt-year-totals">
                            <td class="pt-col-name">Year Total &mdash; GPA: ${stats.gpa}</td>
                            <td class="pt-col-credits">${stats.credits}</td>
                            <td class="pt-col-grade"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>`;
    }

    // ── Helper: build exam scores panel ───────────────────────
    function buildExamPanel() {
        const exams = currentPlan.exams || [];
        if (exams.length === 0) return '<div class="pt-year-panel pt-year-empty"></div>';

        let rows = '';
        exams.forEach(exam => {
            rows += `
                <tr>
                    <td class="pt-col-name">${exam.name}</td>
                    <td class="pt-col-credits">${exam.date || ''}</td>
                    <td class="pt-col-grade">${exam.score}</td>
                </tr>`;
        });

        return `
            <div class="pt-year-panel">
                <table class="pt-year-table">
                    <thead>
                        <tr class="pt-year-header-row">
                            <th class="pt-yh-name">Exam Scores</th>
                            <th class="pt-yh-year" colspan="2"></th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;
    }

    // ── Year pairs ────────────────────────────────────────────
    // years[0]=8th, years[1]=9th, years[2]=10th, years[3]=11th, years[4]=12th
    const years = CONFIG.YEARS;

    const pair1 = `
        <div class="pt-row">
            ${buildYearPanel(years[1])}
            ${buildYearPanel(years[2])}
        </div>`;

    const pair2 = `
        <div class="pt-row">
            ${buildYearPanel(years[3])}
            ${buildYearPanel(years[4])}
        </div>`;

    // Row 3 — 8th grade + exam scores (only if either has data)
    const has8th   = (currentPlan.courses[8]  || []).length > 0;
    const hasExams = (currentPlan.exams        || []).length > 0;
    const pair3    = (has8th || hasExams) ? `
        <div class="pt-row">
            ${buildYearPanel(years[0])}
            ${buildExamPanel()}
        </div>` : '';

    let html = `
    <div class="pro-transcript">

        <!-- LETTERHEAD -->
        <div class="pt-letterhead">
            ${currentPlan.schoolLogo ?
                `<img src="${currentPlan.schoolLogo}" class="pt-logo-img" alt="School Logo">` :
                ''}
            <div class="pt-school-name">${currentPlan.schoolName || 'School Name'}</div>
            <div class="pt-school-meta">${schoolMeta}</div>
        </div>

        <!-- STUDENT META -->
        <table class="pt-meta-table">
            <tbody>
                <tr>
                    <td class="pt-meta-label">Student</td>
                    <td class="pt-meta-value">${currentPlan.studentName || ''}</td>
                    <td class="pt-meta-label">DOB</td>
                    <td class="pt-meta-value">${studentDOB}</td>
                    <td class="pt-meta-label">Grad. Year</td>
                    <td class="pt-meta-value">${currentPlan.graduationYear || ''}</td>
                    <td class="pt-meta-label">Cum. GPA</td>
                    <td class="pt-meta-value pt-meta-gpa">${overallStats.cumulativeGPA}</td>
                    <td class="pt-meta-label">Credits</td>
                    <td class="pt-meta-value">${overallStats.totalCredits}</td>
                </tr>
                ${currentPlan.studentAddress ? `
                <tr>
                    <td class="pt-meta-label">Address</td>
                    <td colspan="9" class="pt-meta-value">${currentPlan.studentAddress}</td>
                </tr>` : ''}
            </tbody>
        </table>

        <!-- TITLE -->
        <div class="pt-record-title">Official Academic Record</div>

        <!-- SHARED COLUMN HEADERS -->
        <div class="pt-col-labels">
            <div class="pt-col-label-set">
                <span class="pt-cl-name">Course Title</span>
                <span class="pt-cl-credits">Credits</span>
                <span class="pt-cl-grade">Final Grade</span>
            </div>
            <div class="pt-col-label-divider"></div>
            <div class="pt-col-label-set">
                <span class="pt-cl-name">Course Title</span>
                <span class="pt-cl-credits">Credits</span>
                <span class="pt-cl-grade">Final Grade</span>
            </div>
        </div>

        <!-- YEAR PAIRS -->
        ${pair1}
        ${pair2}
        ${pair3}

        <!-- GRADING SCALE -->
        <div class="pt-scale-bar">
            <strong>Grading Scale:</strong>
            A&nbsp;=&nbsp;90–100 &nbsp;|&nbsp; B&nbsp;=&nbsp;80–89 &nbsp;|&nbsp; C&nbsp;=&nbsp;70–79 &nbsp;|&nbsp; D&nbsp;=&nbsp;60–69 &nbsp;|&nbsp; F&nbsp;=&nbsp;0–59 &nbsp;|&nbsp; P&nbsp;=&nbsp;Pass (not calculated in GPA)
            &nbsp;&nbsp;&bull;&nbsp;&nbsp;
            <strong>GPA Weights:</strong> Regular&nbsp;4.0 &nbsp;|&nbsp; Honors&nbsp;4.5 &nbsp;|&nbsp; AP/IB/Dual Enrollment&nbsp;5.0
            &nbsp;&nbsp;&bull;&nbsp;&nbsp;
            <strong>Key:</strong> <sup>H</sup>&nbsp;Honors &nbsp;<sup>AP</sup>&nbsp;AP &nbsp;<sup>DE</sup>&nbsp;Dual Enrollment &nbsp;<sup>IB</sup>&nbsp;IB
        </div>

        <!-- CERTIFICATION -->
        <div class="pt-cert">${certLine}</div>

        <!-- SIGNATURE BLOCK -->
        <div class="pt-signature-block">
            <div class="pt-sig-col">
                <div class="pt-sig-line"></div>
                <div class="pt-sig-label">Administrator / Parent-Educator Signature</div>
            </div>
            <div class="pt-sig-col">
                <div class="pt-sig-line"></div>
                <div class="pt-sig-label">Date</div>
            </div>
        </div>

    </div>`;

    output.innerHTML = html;
}


// ── Stat helpers ──────────────────────────────────────────────

function calculateYearStats(courses) {
    let credits = 0, gpaPoints = 0, gradedCredits = 0;
    courses.forEach(course => {
        credits += course.credits;
        if (course.gpaPoints !== null) {
            gpaPoints     += course.gpaPoints * course.credits;
            gradedCredits += course.credits;
        }
    });
    const gpa = gradedCredits > 0 ? gpaPoints / gradedCredits : 0;
    return { credits: credits.toFixed(1), gpa: formatGPA(gpa) };
}

function calculateOverallStats() {
    let totalCredits = 0, totalGPAPoints = 0, totalGradedCredits = 0, totalCourses = 0;
    CONFIG.YEARS.forEach(year => {
        const courses = currentPlan.courses[year.number] || [];
        courses.forEach(course => {
            totalCourses++;
            totalCredits += course.credits;
            if (course.gpaPoints !== null) {
                totalGPAPoints     += course.gpaPoints * course.credits;
                totalGradedCredits += course.credits;
            }
        });
    });
    const cumulativeGPA = totalGradedCredits > 0 ? totalGPAPoints / totalGradedCredits : 0;
    return {
        totalCredits:  totalCredits.toFixed(1),
        cumulativeGPA: formatGPA(cumulativeGPA),
        totalCourses
    };
}

function printTranscript() {
    if (!document.querySelector('.pro-transcript')) {
        alert('Please generate a transcript first.');
        return;
    }
    window.print();
}

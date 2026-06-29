// Configuration for HomeschoolHS Planner
const CONFIG = {
    // Grading scale for GPA calculation
    GRADES: {
        'A': 4.0,
        'B': 3.0,
        'C': 2.0,
        'D': 1.0,
        'F': 0.0,
        'P': null  // Pass - no GPA weight
    },
    // GPA weights by course type
    GPA_WEIGHTS: {
        'Regular':          0,
        'Honors':           0.5,
        'AP':               1.0,
        'IB':               1.0,
        'Dual Enrollment':  1.0
    },
    // Course types
    COURSE_TYPES: ['Regular', 'Honors', 'AP', 'IB', 'Dual Enrollment'],
    // School years — 8th through 12th
    YEARS: [
        { number: 8,  name: '8th Grade',  label: '8th Grade (Prior Credits)' },
        { number: 9,  name: 'Freshman',   label: 'Freshman'  },
        { number: 10, name: 'Sophomore',  label: 'Sophomore' },
        { number: 11, name: 'Junior',     label: 'Junior'    },
        { number: 12, name: 'Senior',     label: 'Senior'    }
    ],
    // Graduation year range
    GRAD_YEAR_MIN: new Date().getFullYear() - 10,
    GRAD_YEAR_MAX: new Date().getFullYear() + 8,
    // Storage key
    STORAGE_KEY: 'homeschoolhs_plan',
    // Default student
    DEFAULT_STUDENT: {
        name: 'Student',
        school: 'HomeschoolHS',
        graduationYear: new Date().getFullYear() + 4
    }
};

// Helper function to calculate GPA points with weighting
function getGPAPoints(grade, courseType) {
    const base = CONFIG.GRADES[grade];
    if (base === null || base === undefined) return null;
    const weight = CONFIG.GPA_WEIGHTS[courseType] || 0;
    return base + weight;
}

// Helper function to format GPA
function formatGPA(gpa) {
    return isNaN(gpa) ? '0.00' : gpa.toFixed(2);
}

// Helper function to get current plan key — fixed key, not name-based
function getPlanKey() {
    return CONFIG.STORAGE_KEY;
}

// Helper function to sanitize keys
function sanitizeKey(key) {
    return key.toLowerCase().replace(/[^a-z0-9]/g, '_');
}

// Helper function to get all saved students
function getSavedStudents() {
    const students = [];
    for (let key in localStorage) {
        if (key.startsWith(CONFIG.STORAGE_KEY)) {
            const studentName = key.replace(CONFIG.STORAGE_KEY + '_', '');
            students.push(studentName);
        }
    }
    return students;
}

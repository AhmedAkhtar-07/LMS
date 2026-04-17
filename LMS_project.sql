/* =============================================================
   LMS Database Schema — MySQL
   Project : Online Learning Management System
   Section : BSE-4A | Group 12
   =============================================================
   TABLES
     1.  Departments        (lookup — shared by students & instructors)
     2.  Users              (auth info only — email, password, role)
     3.  StudentProfiles    (student-specific info — 1:1 with Users)
     4.  InstructorProfiles (instructor-specific info — 1:1 with Users)
     5.  Courses
     6.  Modules
     7.  Materials
     8.  Quizzes
     9.  Questions
     10. Enrollments
     11. Progress
     12. QuizAttempts
     13. Certificates

   VIEWS
     1. StudentEnrollments
     2. InstructorCourses
     3. QuizResults
     4. CourseModules
     5. StudentProgress
   =============================================================

   NORMALIZATION NOTES
   ───────────────────
   • Users holds only authentication data (email, password, role).
     Role-specific fields are split into StudentProfiles and
     InstructorProfiles — this satisfies 3NF and avoids NULL columns
     on the wrong role (e.g. a student should not have a 'designation').

   • Departments is a lookup table referenced by both profile tables.
     Storing department name as a plain VARCHAR in profiles would
     create an update anomaly — fixing 3NF by extracting it here.

   • Questions stores MCQ options as 4 columns (option_a … option_d).
     A fully normalised design would use a separate QuestionOptions
     table, but for this project scope the column approach is simpler
     and easier to query without sacrificing correctness.
   ============================================================= */



/* ── DATABASE ─────────────────────────────────────────────── */

CREATE DATABASE IF NOT EXISTS LMS_project;
USE LMS_project;


/* ── 1. DEPARTMENTS ───────────────────────────────────────── */
-- Lookup table for university departments.
-- Referenced by StudentProfiles and InstructorProfiles.
-- Centralised here so a department name change only needs one UPDATE.

CREATE TABLE Departments (
    department_id   INT          PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL UNIQUE  -- e.g. 'Software Engineering'
);


/* ── 2. USERS ─────────────────────────────────────────────── */
-- Authentication data only — nothing role-specific lives here.
-- Role-specific fields are in StudentProfiles / InstructorProfiles.

CREATE TABLE Users (
    user_id  INT          PRIMARY KEY AUTO_INCREMENT,
    name     VARCHAR(100) NOT NULL,
    email    VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,               -- bcrypt hash, never plain text
    role     VARCHAR(20)  NOT NULL CHECK (role IN ('student', 'instructor'))
);


/* ── 3. STUDENT PROFILES ──────────────────────────────────── */
-- One row per student — 1:1 relationship with Users.
-- Stores university-specific fields that only apply to students.
-- Created automatically when a student registers.

CREATE TABLE StudentProfiles (
    student_id    INT         PRIMARY KEY,        -- same as Users.user_id
    roll_number   VARCHAR(20) NOT NULL UNIQUE,    -- university roll number e.g. 24L-3018
    semester      TINYINT     NOT NULL CHECK (semester BETWEEN 1 AND 8),
    department_id INT         NOT NULL,

    -- 1:1 link to Users; cascade delete removes profile if user is deleted
    FOREIGN KEY (student_id)    REFERENCES Users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES Departments(department_id)
);

CREATE INDEX idx_student_department ON StudentProfiles(department_id);


/* ── 4. INSTRUCTOR PROFILES ───────────────────────────────── */
-- One row per instructor — 1:1 relationship with Users.
-- Stores fields that only apply to instructors.
-- Created automatically when an instructor registers.

CREATE TABLE InstructorProfiles (
    instructor_id INT          PRIMARY KEY,       -- same as Users.user_id
    designation   VARCHAR(100) NOT NULL DEFAULT 'Lecturer',
                                                  -- e.g. Lecturer, Asst. Professor
    bio           TEXT,                           -- short instructor description
    department_id INT          NOT NULL,

    FOREIGN KEY (instructor_id)  REFERENCES Users(user_id)       ON DELETE CASCADE,
    FOREIGN KEY (department_id)  REFERENCES Departments(department_id)
);

CREATE INDEX idx_instructor_department ON InstructorProfiles(department_id);


/* ── 5. COURSES ───────────────────────────────────────────── */
-- Created by instructors only.
-- course_id is the unique course identifier.

CREATE TABLE Courses (
    course_id     INT          PRIMARY KEY AUTO_INCREMENT,
    title         VARCHAR(200) NOT NULL,
    description   TEXT,
    instructor_id INT          NOT NULL,

    FOREIGN KEY (instructor_id) REFERENCES Users(user_id) ON DELETE CASCADE
);

CREATE INDEX idx_courses_instructor ON Courses(instructor_id);


/* ── 6. MODULES ───────────────────────────────────────────── */
-- A course is divided into ordered modules.
-- module_order controls display sequence within a course.

CREATE TABLE Modules (
    module_id    INT          PRIMARY KEY AUTO_INCREMENT,
    course_id    INT          NOT NULL,
    title        VARCHAR(200) NOT NULL,
    module_order INT          NOT NULL CHECK (module_order > 0),

    FOREIGN KEY (course_id) REFERENCES Courses(course_id) ON DELETE CASCADE
);

CREATE INDEX idx_modules_course ON Modules(course_id);


/* ── 7. MATERIALS ─────────────────────────────────────────── */
-- Learning content attached to a module.
-- type determines how it is rendered (pdf, video, announcement).
-- content holds text/embed link; file_url holds the file path.

CREATE TABLE Materials (
    material_id INT          PRIMARY KEY AUTO_INCREMENT,
    module_id   INT          NOT NULL,
    title       VARCHAR(200) NOT NULL,
    type        VARCHAR(20)  NOT NULL CHECK (type IN ('pdf', 'video', 'announcement')),
    content     TEXT,                             -- text body or embed URL
    file_url    VARCHAR(500),                     -- path for uploaded file
    created_at  DATETIME     DEFAULT NOW(),

    FOREIGN KEY (module_id) REFERENCES Modules(module_id) ON DELETE CASCADE
);

CREATE INDEX idx_materials_module ON Materials(module_id);


/* ── 8. QUIZZES ───────────────────────────────────────────── */
-- Each module can have one quiz.
-- passing_score is the minimum % needed to pass (used for certificates).

CREATE TABLE Quizzes (
    quiz_id       INT          PRIMARY KEY AUTO_INCREMENT,
    module_id     INT          NOT NULL,
    title         VARCHAR(200) NOT NULL,
    passing_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,

    FOREIGN KEY (module_id) REFERENCES Modules(module_id) ON DELETE CASCADE
);

CREATE INDEX idx_quizzes_module ON Quizzes(module_id);


/* ── 9. QUESTIONS ─────────────────────────────────────────── */
-- MCQ questions belonging to a quiz.
-- Options A and B are required; C and D are optional.
-- correct_option stores the letter of the right answer.

CREATE TABLE Questions (
    question_id    INT          PRIMARY KEY AUTO_INCREMENT,
    quiz_id        INT          NOT NULL,
    question_text  TEXT         NOT NULL,
    option_a       VARCHAR(200) NOT NULL,
    option_b       VARCHAR(200) NOT NULL,
    option_c       VARCHAR(200),                  -- optional
    option_d       VARCHAR(200),                  -- optional
    correct_option CHAR(1)      NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),

    FOREIGN KEY (quiz_id) REFERENCES Quizzes(quiz_id) ON DELETE CASCADE
);

CREATE INDEX idx_questions_quiz ON Questions(quiz_id);


/* ── 10. ENROLLMENTS ──────────────────────────────────────── */
-- Records which student is enrolled in which course.
-- status tracks the enrollment lifecycle.
-- UNIQUE prevents a student enrolling in the same course twice.

CREATE TABLE Enrollments (
    enrollment_id INT         PRIMARY KEY AUTO_INCREMENT,
    student_id    INT         NOT NULL,
    course_id     INT         NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'completed', 'dropped')),
    enroll_date   DATE        DEFAULT (CURRENT_DATE),

    UNIQUE (student_id, course_id),

    FOREIGN KEY (student_id) REFERENCES Users(user_id),
    FOREIGN KEY (course_id)  REFERENCES Courses(course_id) ON DELETE CASCADE
);

CREATE INDEX idx_enrollments_student ON Enrollments(student_id);
CREATE INDEX idx_enrollments_course  ON Enrollments(course_id);


/* ── 11. PROGRESS ─────────────────────────────────────────── */
-- Tracks which materials each student has accessed.
-- Used by the performance dashboard to calculate completion %.
-- UNIQUE ensures each material is counted only once per student.

CREATE TABLE Progress (
    progress_id INT      PRIMARY KEY AUTO_INCREMENT,
    student_id  INT      NOT NULL,
    material_id INT      NOT NULL,
    accessed_at DATETIME DEFAULT NOW(),

    UNIQUE (student_id, material_id),

    FOREIGN KEY (student_id)  REFERENCES Users(user_id),
    FOREIGN KEY (material_id) REFERENCES Materials(material_id) ON DELETE CASCADE
);

CREATE INDEX idx_progress_student ON Progress(student_id);


/* ── 12. QUIZ ATTEMPTS ────────────────────────────────────── */
-- Records every quiz attempt by a student.
-- No UNIQUE — students can attempt a quiz multiple times.
-- Score is out of 100.

CREATE TABLE QuizAttempts (
    attempt_id   INT          PRIMARY KEY AUTO_INCREMENT,
    student_id   INT          NOT NULL,
    quiz_id      INT          NOT NULL,
    score        DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    attempt_date DATETIME     DEFAULT NOW(),

    FOREIGN KEY (student_id) REFERENCES Users(user_id),
    FOREIGN KEY (quiz_id)    REFERENCES Quizzes(quiz_id) ON DELETE CASCADE
);

CREATE INDEX idx_attempts_student ON QuizAttempts(student_id);
CREATE INDEX idx_attempts_quiz    ON QuizAttempts(quiz_id);


/* ── 13. CERTIFICATES ─────────────────────────────────────── */
-- Issued when a student completes a course with passing quiz scores.
-- UNIQUE ensures one certificate per student per course.

CREATE TABLE Certificates (
    certificate_id INT  PRIMARY KEY AUTO_INCREMENT,
    student_id     INT  NOT NULL,
    course_id      INT  NOT NULL,
    issue_date     DATE DEFAULT (CURRENT_DATE),

    UNIQUE (student_id, course_id),

    FOREIGN KEY (student_id) REFERENCES Users(user_id),
    FOREIGN KEY (course_id)  REFERENCES Courses(course_id)
);

CREATE INDEX idx_certificates_student ON Certificates(student_id);


/* =============================================================
   VIEWS
   ============================================================= */

-- 1. Students with their enrolled courses and status
CREATE VIEW StudentEnrollments AS
SELECT
    u.name        AS student_name,
    sp.roll_number,
    d.name        AS department,
    c.title       AS course_title,
    e.status      AS enrollment_status,
    e.enroll_date
FROM Enrollments e
JOIN Users          u  ON e.student_id    = u.user_id
JOIN StudentProfiles sp ON sp.student_id  = u.user_id
JOIN Departments    d  ON sp.department_id = d.department_id
JOIN Courses        c  ON e.course_id     = c.course_id;


-- 2. Instructors with their courses and department
CREATE VIEW InstructorCourses AS
SELECT
    u.name        AS instructor_name,
    ip.designation,
    d.name        AS department,
    c.title       AS course_title,
    c.course_id
FROM Courses c
JOIN Users              u  ON c.instructor_id   = u.user_id
JOIN InstructorProfiles ip ON ip.instructor_id  = u.user_id
JOIN Departments        d  ON ip.department_id  = d.department_id;


-- 3. Quiz results per student with pass/fail
CREATE VIEW QuizResults AS
SELECT
    u.name         AS student_name,
    q.title        AS quiz_title,
    qa.score,
    q.passing_score,
    CASE WHEN qa.score >= q.passing_score THEN 'Pass' ELSE 'Fail' END AS result,
    qa.attempt_date
FROM QuizAttempts qa
JOIN Users   u ON qa.student_id = u.user_id
JOIN Quizzes q ON qa.quiz_id    = q.quiz_id;


-- 4. Modules listed under each course in order
CREATE VIEW CourseModules AS
SELECT
    c.title        AS course_title,
    m.title        AS module_title,
    m.module_order
FROM Modules m
JOIN Courses c ON m.course_id = c.course_id
ORDER BY c.course_id, m.module_order;


-- 5. Material progress per student per course
CREATE VIEW StudentProgress AS
SELECT
    u.name                                        AS student_name,
    c.title                                       AS course_title,
    COUNT(DISTINCT mat.material_id)               AS total_materials,
    COUNT(DISTINCT p.material_id)                 AS accessed_materials,
    ROUND(
        COUNT(DISTINCT p.material_id) * 100.0
        / NULLIF(COUNT(DISTINCT mat.material_id), 0)
    , 2)                                          AS progress_percent
FROM Enrollments e
JOIN Users     u   ON e.student_id    = u.user_id
JOIN Courses   c   ON e.course_id     = c.course_id
JOIN Modules   mo  ON mo.course_id    = c.course_id
JOIN Materials mat ON mat.module_id   = mo.module_id
LEFT JOIN Progress p ON p.student_id  = e.student_id
                    AND p.material_id  = mat.material_id
GROUP BY u.user_id, c.course_id;


/* =============================================================
   SEED DATA — Departments
   (Run this once after creating tables)
   ============================================================= */

INSERT INTO Departments (name) VALUES
('Software Engineering'),
('Computer Science'),
('Electrical Engineering'),
('Artificial Intelligence'),
('Cyber Security');

SELECT *FROM Courses;
SELECT *FROM Modules;





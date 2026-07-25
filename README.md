Project
Online Learning Management System (LMS)
Semester Project
Spring 2026
Section: BSE-4A
Group #: 12
Team Lead: Muhammad Talha Hamid (24L-3018)
Domain: Academia

Tech Stack
Frontend: HTML, CSS, JavaScript
Backend: Node.js
Database: MySQL
Project Goal
Build a minimal but functional web-based LMS that satisfies the basic semester project requirements.

The system should allow:

instructors to create courses
instructors to create modules
instructors to add materials
instructors to create quizzes with MCQs
students to enroll in courses
students to access content
students to attempt quizzes
system to auto-grade quizzes
dashboards to show basic performance/progress
certificate generation on completion
Most Important Rule
Do not overbuild.

This project must remain:

minimal
simple
understandable
easy to demo
aligned with proposal requirements only
Avoid adding:

advanced architecture unless necessary
complex frontend frameworks unless already chosen
unnecessary security layers beyond basic student project level
notifications
chat systems
forums
assignment submission
attendance systems
payment systems
admin panel unless explicitly required
fancy analytics
microservices
Docker/Kubernetes
Redis
JWT/OAuth unless absolutely needed
file storage complexity unless necessary
Source of Truth
Use the provided SQL schema as the main reference.

Tables:

Users
Courses
Modules
Materials
Quizzes
Questions
Enrollments
QuizAttempts
Certificates
Prefer solving gaps in application logic rather than changing the schema.

Functional Requirements
User Registration and Authentication
Course Creation
Module Management
Material Content Management
Quiz Creation and Question Management
Course Enrollment
Enrollment Status Management
Quiz Attempt and Grading
Performance Dashboard and Analytics Tracking
Certificate Generation
Development Style
When implementing any feature:

Build the smallest working version first
Keep code clean and readable
Use clear naming
Keep files focused
Do not add hidden complexity
Prefer simple session-based auth
Prefer simple server-rendered pages or plain frontend pages if suitable
Keep UI plain and functional
UI Guidance
UI should be:

very simple
clean
easy to demo
not design-heavy
Minimum pages likely needed:

login
register
student dashboard
instructor dashboard
course list
course details
module details
quiz page
certificate page
No fancy animations or unnecessary styling.

Role Rules
Only two roles:

student
instructor
Student can:

register/login
browse courses
enroll in courses
view enrolled courses
access materials
attempt quizzes
view progress
view certificate if eligible
Instructor can:

login
create/manage courses
create modules
add materials
create quizzes/questions
view enrolled students
view simple analytics
Progress Philosophy
Keep progress calculation simple and explainable.

Preferred approach:

progress is based on completion of module quizzes/material access in the simplest practical way
if exact tracking is difficult with current schema, use a simplified formula and document it clearly
Do not create complicated tracking systems unless absolutely required.

Certificate Philosophy
Certificate should only be generated when:

course progress reaches 100%
student has passing grades in all required quizzes
Implementation can be simple:

HTML certificate page
optional printable page
certificate record stored in database
No need for complex PDF engines unless easy.

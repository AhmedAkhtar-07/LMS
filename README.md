# 📚 Online Learning Management System (LMS)

A minimal yet functional **Online Learning Management System (LMS)** developed as a **Semester Project (Spring 2026)** for the Software Engineering program. The project focuses on providing essential learning management features for both students and instructors while keeping the system simple, clean, and easy to demonstrate.

---

## 📖 Project Information

| Field         | Details                                 |
| ------------- | --------------------------------------- |
| **Project**   | Online Learning Management System (LMS) |
| **Semester**  | Spring 2026                             |
| **Section**   | BSE-4A                                  |
| **Group**     | 12                                      |
| **Domain**    | Academia                                |
| **Team Lead** | Muhammad Talha Hamid (24L-3018)         |

---

## 🎯 Project Goal

The objective of this project is to build a lightweight web-based Learning Management System that satisfies the core semester project requirements without introducing unnecessary complexity.

The application enables instructors to manage courses and learning resources while allowing students to enroll, learn, complete quizzes, track their progress, and receive certificates upon successful course completion.

---

## ✨ Features

### 👨‍🎓 Student

* User Registration & Login
* Browse Available Courses
* Enroll in Courses
* Access Course Modules
* View Learning Materials
* Attempt MCQ-Based Quizzes
* View Quiz Results
* Track Learning Progress
* Download/View Course Completion Certificate

### 👨‍🏫 Instructor

* Secure Login
* Create & Manage Courses
* Create Course Modules
* Upload Learning Materials
* Create Quizzes
* Add Multiple Choice Questions (MCQs)
* View Enrolled Students
* View Basic Student Performance

### ⚙️ System

* Session-Based Authentication
* Automatic Quiz Grading
* Progress Tracking
* Certificate Generation
* MySQL Database Integration

---

## 🛠️ Tech Stack

| Technology     | Usage          |
| -------------- | -------------- |
| **HTML5**      | Structure      |
| **CSS3**       | Styling        |
| **JavaScript** | Frontend Logic |
| **Node.js**    | Backend        |
| **MySQL**      | Database       |

---

## 📂 Database Schema

The project is based on the following database tables:

* Users
* Courses
* Modules
* Materials
* Quizzes
* Questions
* Enrollments
* QuizAttempts
* Certificates

---

---

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/<username>/<repository>.git
```

Navigate to the project directory:

```bash
cd LMS
```

Install the required dependencies:

```bash
npm install
```

Configure your MySQL database and update the database credentials in the configuration file.

Start the server:

```bash
npm start
```

or

```bash
npm run dev
```

---

## 🖥️ Main Pages

* Login
* Register
* Student Dashboard
* Instructor Dashboard
* Course List
* Course Details
* Module Details
* Quiz Page
* Certificate Page

---

## 📊 Progress Tracking

Student progress is calculated using a simple and easy-to-understand approach based on course completion and quiz performance. This keeps the implementation lightweight while meeting the project requirements.

---

## 🏆 Certificate Generation

A certificate is generated when:

* The student achieves **100% course progress**
* All required quizzes are successfully passed

The certificate is stored in the database and can be viewed or printed from the application.

---

## 🎨 Design Philosophy

This project intentionally follows a minimal approach.

* Simple UI
* Clean Code
* Easy Navigation
* Readable Project Structure
* Easy Demonstration
* No Unnecessary Complexity

---

## 📸 Screenshots

> Add screenshots of the application here.

* Login Page
* Student Dashboard
* Instructor Dashboard
* Course Page
* Quiz Page
* Certificate Page

---

## 👥 Contributors

* Muhammad Talha Hamid (Team Lead)
* Group 12 Members

---

## 📄 License

This project was developed for educational purposes as part of the **Spring 2026 Semester Project**.

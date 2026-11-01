# College Database Schema & Architecture Guide

This dataset has been created specifically for the **Smart Database Visualizer** project. It showcases diverse real-world relational database concepts, including **One-to-Many**, **Many-to-Many**, and **One-to-One** relationships, as well as composite keys.

---

## 1. Quick One-Step Setup

We have included a setup script in the project so you can load this entire dataset into MySQL with a single command without dealing with MySQL Workbench or command line pipes.

In your terminal:
```bash
cd backend
node setup-db.js YOUR_MYSQL_PASSWORD
```
*(Replace `YOUR_MYSQL_PASSWORD` with your actual MySQL root password, e.g., `node setup-db.js root`)*

---

## 2. Database Structure

Database Name: `college_db`

### Entity Relationship Diagram Overview

```
 [department] (1) ────< (N) [student] (1) ──── (1) [address]
      │                         │
      │ (1)                     │ (1)
      │                         │
      ▼ (N)                     ▼ (N)
 [instructor]              [enrollment]
      │                         │
      │ (1)                     │ (N)
      ▼ (N)                     ▼ (1)
 [course_instructor] >──── (1) [course]
```

---

## 3. Table Details & Relationship Types

### 1. `department` (Root Parent Table)
- **Primary Key:** `dept_id` (INT, AUTO_INCREMENT)
- **Attributes:** `dept_name` (VARCHAR), `location` (VARCHAR)
- **Purpose:** Represents academic departments (Computer Science, IT, Electronics, etc.).

### 2. `student` (One-to-Many with `department`)
- **Primary Key:** `student_id` (INT, AUTO_INCREMENT)
- **Foreign Key:** `dept_id` references `department(dept_id)`
- **Attributes:** `first_name`, `last_name`, `email` (UNIQUE), `date_of_birth`
- **Concept:** Every student belongs to one department; a department has many students.

### 3. `instructor` (One-to-Many with `department`)
- **Primary Key:** `instructor_id` (INT, AUTO_INCREMENT)
- **Foreign Key:** `dept_id` references `department(dept_id)`
- **Attributes:** `instructor_name`, `email` (UNIQUE)
- **Concept:** Faculty members associated with a department.

### 4. `course` (One-to-Many with `department`)
- **Primary Key:** `course_id` (INT, AUTO_INCREMENT)
- **Foreign Key:** `dept_id` references `department(dept_id)`
- **Attributes:** `course_name`, `credits`
- **Concept:** Courses offered by specific departments.

### 5. `enrollment` (Bridge Table: `student` & `course`)
- **Primary Key:** `enrollment_id` (INT, AUTO_INCREMENT)
- **Foreign Keys:**
  - `student_id` references `student(student_id)`
  - `course_id` references `course(course_id)`
- **Attributes:** `enrollment_date`
- **Concept:** Tracks which students are enrolled in which courses.

### 6. `course_instructor` (Many-to-Many Junction Table)
- **Composite Primary Key:** `(course_id, instructor_id)`
- **Foreign Keys:**
  - `course_id` references `course(course_id)`
  - `instructor_id` references `instructor(instructor_id)`
- **Concept:** An instructor can teach multiple courses, and a course can be co-taught by multiple instructors. Demonstrates a pure junction table with a **composite primary key**.

### 7. `address` (One-to-One with `student`)
- **Primary Key:** `address_id` (INT, AUTO_INCREMENT)
- **Foreign Key & Unique:** `student_id` (UNIQUE) references `student(student_id)`
- **Attributes:** `street`, `city`, `state`, `postal_code`
- **Concept:** Each student has exactly one residential address record.

---

## 4. Connecting in the UI

Once the script has been run:
1. Open [http://localhost:3000](http://localhost:3000)
2. Enter:
   - **Host:** `localhost`
   - **Port:** `3306`
   - **Database Name:** `college_db`
   - **Username:** `root`
   - **Password:** *(your password)*
3. Click **Connect Database**.

You can now click any table or column in the visualizer to inspect:
- Dependency analysis (which tables depend on this table)
- Foreign key lineages
- Cardinality explanations (e.g. `N:1`, `1:1`)

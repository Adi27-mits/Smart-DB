-- =========================================================
-- SMART DATABASE VISUALIZER - COLLEGE DATASET
-- Database Name: college_db
-- =========================================================

-- Drop and create database so it is guaranteed to match 'college_db'
CREATE DATABASE IF NOT EXISTS college_db;
USE college_db;

-- Drop tables if they already exist (in reverse dependency order)
DROP TABLE IF EXISTS address;
DROP TABLE IF EXISTS course_instructor;
DROP TABLE IF EXISTS enrollment;
DROP TABLE IF EXISTS course;
DROP TABLE IF EXISTS instructor;
DROP TABLE IF EXISTS student;
DROP TABLE IF EXISTS department;

-- =========================================================
-- 1. DEPARTMENT TABLE (Parent table)
-- =========================================================
CREATE TABLE department (
    dept_id INT AUTO_INCREMENT PRIMARY KEY,
    dept_name VARCHAR(100) NOT NULL,
    location VARCHAR(100)
);

-- =========================================================
-- 2. STUDENT TABLE (References department)
-- =========================================================
CREATE TABLE student (
    student_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50),
    email VARCHAR(100) UNIQUE,
    date_of_birth DATE,
    dept_id INT,

    CONSTRAINT fk_student_department
        FOREIGN KEY (dept_id)
        REFERENCES department(dept_id)
);

-- =========================================================
-- 3. INSTRUCTOR TABLE (References department)
-- =========================================================
CREATE TABLE instructor (
    instructor_id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    dept_id INT,

    CONSTRAINT fk_instructor_department
        FOREIGN KEY (dept_id)
        REFERENCES department(dept_id)
);

-- =========================================================
-- 4. COURSE TABLE (References department)
-- =========================================================
CREATE TABLE course (
    course_id INT AUTO_INCREMENT PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL,
    credits INT NOT NULL,
    dept_id INT,

    CONSTRAINT fk_course_department
        FOREIGN KEY (dept_id)
        REFERENCES department(dept_id)
);

-- =========================================================
-- 5. ENROLLMENT TABLE (Bridge table: student <-> course)
-- =========================================================
CREATE TABLE enrollment (
    enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    enrollment_date DATE,

    CONSTRAINT fk_enrollment_student
        FOREIGN KEY (student_id)
        REFERENCES student(student_id),

    CONSTRAINT fk_enrollment_course
        FOREIGN KEY (course_id)
        REFERENCES course(course_id)
);

-- =========================================================
-- 6. COURSE_INSTRUCTOR TABLE (Many-to-Many bridge)
-- =========================================================
CREATE TABLE course_instructor (
    course_id INT NOT NULL,
    instructor_id INT NOT NULL,

    PRIMARY KEY (course_id, instructor_id),

    CONSTRAINT fk_ci_course
        FOREIGN KEY (course_id)
        REFERENCES course(course_id),

    CONSTRAINT fk_ci_instructor
        FOREIGN KEY (instructor_id)
        REFERENCES instructor(instructor_id)
);

-- =========================================================
-- 7. ADDRESS TABLE (1-to-1 relationship with student)
-- =========================================================
CREATE TABLE address (
    address_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT UNIQUE,
    street VARCHAR(150),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),

    CONSTRAINT fk_address_student
        FOREIGN KEY (student_id)
        REFERENCES student(student_id)
);

-- =========================================================
-- SAMPLE DATA INSERTION
-- =========================================================

-- Departments
INSERT INTO department (dept_name, location) VALUES
('Computer Science', 'Block A'),
('Information Technology', 'Block B'),
('Electronics & Communication', 'Block C'),
('Mechanical Engineering', 'Block D');

-- Students
INSERT INTO student (first_name, last_name, email, date_of_birth, dept_id) VALUES
('Rahul', 'Sharma', 'rahul.sharma@example.com', '2004-05-12', 1),
('Priya', 'Patel', 'priya.patel@example.com', '2003-11-20', 1),
('Aman', 'Verma', 'aman.verma@example.com', '2004-02-15', 2),
('Neha', 'Singh', 'neha.singh@example.com', '2003-08-10', 3),
('Rohit', 'Kumar', 'rohit.kumar@example.com', '2004-01-25', 1);

-- Instructors
INSERT INTO instructor (instructor_name, email, dept_id) VALUES
('Dr. Anil Mehta', 'anil.mehta@example.com', 1),
('Dr. Sunita Rao', 'sunita.rao@example.com', 2),
('Prof. Raj Malhotra', 'raj.malhotra@example.com', 3);

-- Courses
INSERT INTO course (course_name, credits, dept_id) VALUES
('Data Structures & Algorithms', 4, 1),
('Database Management Systems', 4, 1),
('Computer Networks', 3, 1),
('Full Stack Web Development', 3, 2),
('Digital Electronics', 4, 3);

-- Enrollments
INSERT INTO enrollment (student_id, course_id, enrollment_date) VALUES
(1, 1, '2026-01-10'),
(1, 2, '2026-01-10'),
(2, 1, '2026-01-11'),
(2, 3, '2026-01-11'),
(3, 4, '2026-01-12'),
(4, 5, '2026-01-13'),
(5, 1, '2026-01-14'),
(5, 2, '2026-01-14');

-- Course Instructors
INSERT INTO course_instructor (course_id, instructor_id) VALUES
(1, 1),
(2, 1),
(3, 1),
(4, 2),
(5, 3);

-- Student Addresses
INSERT INTO address (student_id, street, city, state, postal_code) VALUES
(1, 'MG Road', 'Indore', 'Madhya Pradesh', '452001'),
(2, 'Ring Road', 'Surat', 'Gujarat', '395003'),
(3, 'Station Road', 'Ahmedabad', 'Gujarat', '380001'),
(4, 'Civil Lines', 'Jaipur', 'Rajasthan', '302006'),
(5, 'Main Road', 'Bhopal', 'Madhya Pradesh', '462001');

-- Smart Database Visualizer - Milestone 4 Test Database
-- Target: MySQL 8.x
-- Purpose: Test schema analysis, anti-pattern detection, recommendations, SQL execution, and CRUD.
-- NOTE: Several design issues are intentional.

DROP DATABASE IF EXISTS sdv_milestone4_test;
CREATE DATABASE sdv_milestone4_test;
USE sdv_milestone4_test;

-- Healthy reference table
CREATE TABLE departments (
    department_id INT PRIMARY KEY AUTO_INCREMENT,
    department_name VARCHAR(100) NOT NULL UNIQUE
);

-- Healthy reference table
CREATE TABLE courses (
    course_id INT PRIMARY KEY AUTO_INCREMENT,
    course_name VARCHAR(120) NOT NULL,
    department_id INT NOT NULL,
    CONSTRAINT fk_courses_department
        FOREIGN KEY (department_id) REFERENCES departments(department_id)
);

-- Intentional issue: department_id looks like an FK but has no FK constraint.
-- Intentional issue: department_id is not indexed.
CREATE TABLE students (
    student_id INT PRIMARY KEY AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL,
    department_id INT,
    admission_year INT NOT NULL
);

-- Healthy junction-like table
CREATE TABLE enrollments (
    enrollment_id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    enrolled_on DATE NOT NULL,
    CONSTRAINT fk_enrollments_student
        FOREIGN KEY (student_id) REFERENCES students(student_id),
    CONSTRAINT fk_enrollments_course
        FOREIGN KEY (course_id) REFERENCES courses(course_id),
    CONSTRAINT uq_student_course UNIQUE (student_id, course_id)
);

-- Intentional issue: no primary key
CREATE TABLE attendance_log (
    student_id INT NOT NULL,
    course_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL
);

-- Intentional issue: completely orphaned table (no incoming/outgoing FKs)
CREATE TABLE audit_notes (
    note_id INT PRIMARY KEY AUTO_INCREMENT,
    note_text VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Intentional issue: customer_id looks like an FK but no FK constraint exists.
-- Intentional issue: customer_id is not indexed.
CREATE TABLE customers (
    customer_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL
);

CREATE TABLE orders (
    order_id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    order_date DATE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL
);

-- Healthy FK but useful for dependency analysis
CREATE TABLE order_items (
    order_item_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    course_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(order_id),
    CONSTRAINT fk_order_items_course
        FOREIGN KEY (course_id) REFERENCES courses(course_id)
);

-- CRUD-friendly table
CREATE TABLE tasks (
    task_id INT PRIMARY KEY AUTO_INCREMENT,
    owner_student_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tasks_student
        FOREIGN KEY (owner_student_id) REFERENCES students(student_id)
);

-- Sample data
INSERT INTO departments (department_name) VALUES
('Computer Science'),
('Design'),
('Business');

INSERT INTO courses (course_name, department_id) VALUES
('Database Systems', 1),
('Web Development', 1),
('UI Design', 2);

INSERT INTO students (full_name, email, department_id, admission_year) VALUES
('Aman Chaurasia', 'aman@example.com', 1, 2026),
('Aditya Sahu', 'aditya@example.com', 2, 2026),
('Riya Sharma', 'riya@example.com', 1, 2025);

INSERT INTO enrollments (student_id, course_id, enrolled_on) VALUES
(1, 1, '2026-08-10'),
(1, 2, '2026-08-10'),
(2, 3, '2026-08-11');

INSERT INTO attendance_log (student_id, course_id, attendance_date, status) VALUES
(1, 1, '2026-10-01', 'PRESENT'),
(2, 3, '2026-10-01', 'ABSENT');

INSERT INTO audit_notes (note_text) VALUES
('Standalone table added intentionally for orphan detection.');

INSERT INTO customers (customer_name, email) VALUES
('Customer One', 'customer1@example.com'),
('Customer Two', 'customer2@example.com');

INSERT INTO orders (customer_id, order_date, total_amount) VALUES
(1, '2026-10-01', 499.00),
(2, '2026-10-02', 799.00);

INSERT INTO order_items (order_id, course_id, quantity) VALUES
(1, 1, 1),
(2, 2, 1);

INSERT INTO tasks (owner_student_id, title, status) VALUES
(1, 'Test CREATE operation', 'OPEN'),
(2, 'Test UPDATE operation', 'OPEN');

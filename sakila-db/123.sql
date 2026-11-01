CREATE DATABASE C;
USE C;

CREATE TABLE Student (
    student_id INT PRIMARY KEY,
    student_name VARCHAR(50),
    department VARCHAR(30)
);

CREATE TABLE Course (
    course_id INT PRIMARY KEY,
    course_name VARCHAR(50)
);

CREATE TABLE Enrollment (
    student_id INT,
    course_id INT,
    PRIMARY KEY (student_id, course_id),
    FOREIGN KEY (student_id) REFERENCES Student(student_id),
    FOREIGN KEY (course_id) REFERENCES Course(course_id)
);

INSERT INTO Student VALUES
(1, 'Aditya', 'CSE'),
(2, 'SUPRIYA', 'IT');

INSERT INTO Course VALUES
(101, 'DBMS'),
(102, 'Python');

INSERT INTO Enrollment VALUES
(1, 101),
(2, 102);
import { Injectable, NotFoundException } from '@nestjs/common';
import { NotFoundError } from 'rxjs';

@Injectable()
export class StudentService {
  private students = [
    {
      id: 1,
      name: 'Aarav Sharma',
      age: 20,
      course: 'Computer Science',
      semester: 4,
      email: 'aarav.sharma@example.com',
      marks: 85,
      isActive: true,
    },
    {
      id: 2,
      name: 'Priya Verma',
      age: 22,
      course: 'Mechanical Engineering',
      semester: 6,
      email: 'priya.verma@example.com',
      marks: 78,
      isActive: true,
    },
    {
      id: 3,
      name: 'Rohan Gupta',
      age: 19,
      course: 'Electrical Engineering',
      semester: 2,
      email: 'rohan.gupta@example.com',
      marks: 92,
      isActive: false,
    },
    {
      id: 4,
      name: 'Sneha Kapoor',
      age: 21,
      course: 'BCA',
      semester: 5,
      email: 'sneha.kapoor@example.com',
      marks: 88,
      isActive: true,
    },
    {
      id: 5,
      name: 'Vikash Singh',
      age: 23,
      course: 'MBA',
      semester: 3,
      email: 'vikash.singh@example.com',
      marks: 81,
      isActive: true,
    },
  ];

  // Logic to get all student data with one function
  getAllStudent() {
    return this.students;
  }

//   function to get student by id
getStudentById(id: number){
    const student = this.students.find((s) => s.id === id);
    if(!student) throw new NotFoundException("Student not found by this id");
    return student;
}

  //   function to create studnet with post API fucntion defined
  createStudent(data: {
    name: string;
    age: number;
    course: string;
    semester: number;
    email: string;
    marks: number;
    isActive: boolean;
  }) {
    const newStudnet = {
      id: Date.now(),
      ...data,
    };
    this.students.push(newStudnet);
    return newStudnet;
  }

  //   function to update the all related data of students
  updateStudent(
    id: number,
    data: {
      name: string;
      age: number;
      course: string;
      semester: number;
      email: string;
      marks: number;
      isActive: boolean;
    },
  ) {
    const index = this.students.findIndex((s) => s.id === id);
    if (index === -1) throw new NotFoundException('Student id not found');
    this.students[index] = { id, ...data };
    return this.students[index];
  }

  //   function to update partial data of student
  patchStudent(
    id: number,
    data: Partial<{
      name: string;
      age: number;
      course: string;
      semester: number;
      email: string;
      marks: number;
      isActive: boolean;
    }>) {
        const student = this.getStudentById(id);
        Object.assign(student, data);
        return student
    }


    // fucntion to delete the student record 
    deleteStudnet(id: number){
        const index = this.students.findIndex((s) => s.id === id);
        if(index === -1) throw new NotFoundException('student id is not found');
        const deleted = this.students.splice(index, 1);
        return {
            message: 'Student Record Deleted',
            student: deleted[0]
        }
    }

}

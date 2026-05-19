import { Injectable } from '@nestjs/common';

@Injectable()
export class EmployeeService {
  private Employee = [
    {
      id: 1,
      name: 'Rahul Sharma',
      age: 28,
      department: 'Software Development',
      designation: 'Frontend Developer',
      salary: 65000,
      email: 'rahul.sharma@example.com',
      isActive: true,
    },
    {
      id: 2,
      name: 'Priya Verma',
      age: 32,
      department: 'Human Resources',
      designation: 'HR Manager',
      salary: 75000,
      email: 'priya.verma@example.com',
      isActive: true,
    },
    {
      id: 3,
      name: 'Aman Gupta',
      age: 26,
      department: 'Software Development',
      designation: 'Backend Developer',
      salary: 70000,
      email: 'aman.gupta@example.com',
      isActive: false,
    },
    {
      id: 4,
      name: 'Neha Kapoor',
      age: 30,
      department: 'Finance',
      designation: 'Accountant',
      salary: 55000,
      email: 'neha.kapoor@example.com',
      isActive: true,
    },
    {
      id: 5,
      name: 'Vikram Singh',
      age: 35,
      department: 'Marketing',
      designation: 'Marketing Lead',
      salary: 85000,
      email: 'vikram.singh@example.com',
      isActive: true,
    },
  ];

  getEmployeeData() {
    return this.Employee;
  }
}

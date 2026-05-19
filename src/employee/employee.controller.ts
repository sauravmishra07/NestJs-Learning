import { Controller, Get } from '@nestjs/common';
import { EmployeeService } from './employee.service';

@Controller('employee')
export class EmployeeController {
    // Dependency Injection     
    constructor(private readonly employeeService: EmployeeService){}

    @Get()
    getAllEmployee() {
        return this.employeeService.getEmployeeData(); 
    }
}

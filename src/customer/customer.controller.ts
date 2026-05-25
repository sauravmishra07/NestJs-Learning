import { Body, Controller, Get, Post } from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create_customer_dto';

@Controller('customer')
export class CustomerController {
    constructor(private readonly customerService: CustomerService) {}

    @Get()
    get() {
        return this.customerService.getAllCustomer();
    }

    @Post()
    addCustomer(@Body() createCustomerDto: CreateCustomerDto) {
        return this.customerService.addCustomer(createCustomerDto);
    }
}

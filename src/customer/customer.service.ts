import { Injectable } from '@nestjs/common';
import { Customer } from './interfaces/customer.interface';
import { CreateCustomerDto } from './dto/create_customer_dto';

@Injectable()
export class CustomerService {
    private customer: Customer[] = [];

    getAllCustomer(): Customer[] {
        return this.customer;
    }

    addCustomer(createCustomerDto: CreateCustomerDto):
    Customer {
        const newCustomer: Customer = {
            id: Date.now(),
            ...createCustomerDto,
        };
        this.customer.push(newCustomer);
        return newCustomer;
    }
}

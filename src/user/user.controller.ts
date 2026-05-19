import { Controller, Get, Post } from '@nestjs/common';

@Controller('user')
export class UserController {
    @Get()
    getUser() {
        return "Hello get Resquest form controller user"
    }

    
}

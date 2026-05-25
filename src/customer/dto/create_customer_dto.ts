import { IsInt, IsString } from "class-validator";

export class CreateCustomerDto {
    @IsString()
    name!: string;
    @IsInt()
    age!: number;
}
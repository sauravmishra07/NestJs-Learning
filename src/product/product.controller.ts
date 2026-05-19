import { Controller, Get, Param } from '@nestjs/common';
import { ProductService } from './product.service';

@Controller('product')
export class ProductController {
    constructor (private readonly productService: ProductService) {}

    @Get() 
    getProducts(){
        return this.productService.getAllProducts();
    }

    @Get('id/:id')
    getProductById(@Param('id') id:string){
        return this.productService.getProductById(Number(id));
    }

    @Get('category/:category')
    getProductByCategory(@Param('category') category: string){
        return this.productService.getProductByCategory(category);
    }
}

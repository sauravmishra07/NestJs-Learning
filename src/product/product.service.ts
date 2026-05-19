import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductService {
  private products = [
    {
      id: 1,
      name: 'Apple MacBook Air M2',
      price: 114999,
      category: 'Laptop',
      brand: 'Apple',
      inStock: true,
    },
    {
      id: 2,
      name: 'Dell Inspiron 15',
      price: 64999,
      category: 'Laptop',
      brand: 'Dell',
      inStock: true,
    },
    {
      id: 3,
      name: 'Samsung Galaxy S24',
      price: 79999,
      category: 'Mobile',
      brand: 'Samsung',
      inStock: false,
    },
    {
      id: 4,
      name: 'Sony WH-1000XM5',
      price: 29999,
      category: 'Headphones',
      brand: 'Sony',
      inStock: true,
    },
  ];

  getAllProducts() {
    return this.products;
  }

  getProductById(id: number) {
    return this.products.find((product) => product.id === id)
  }

  getProductByCategory(category: string) {
    return this.products.filter((product) => product.category.toLowerCase() === category.toLowerCase())
  }
}

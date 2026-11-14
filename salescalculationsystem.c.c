/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates the amount a customer should pay at a supermarket.
 The cashier enters the prices of five products
 Subtotal of KSh 10,000 or more = 10% discount
 Subtotal between KSh 5,000 and KSh 9,999 = 5% discount
 Subtotal below KSh 5,000 = No discount
The program displays the subtotal, discount amount and final amount payable
*/

#include <stdio.h>

// Function prototypes
float calculateSubtotal(float p1, float p2, float p3, float p4, float p5);
float calculateDiscount(float subtotal);
float calculateFinalAmount(float subtotal, float discount);

int main()
{
    float price1, price2, price3, price4, price5;
    float subtotal, discount, final_amount;

    printf("Enter the price of product 1: ");
    scanf("%f", &price1);

    printf("Enter the price of product 2: ");
    scanf("%f", &price2);

    printf("Enter the price of product 3: ");
    scanf("%f", &price3);

    printf("Enter the price of product 4: ");
    scanf("%f", &price4);

    printf("Enter the price of product 5: ");
    scanf("%f", &price5);

    /* Call the functions */
    subtotal = calculateSubtotal(price1, price2, price3, price4, price5);
    discount = calculateDiscount(subtotal);
    final_amount = calculateFinalAmount(subtotal, discount);

    printf("Subtotal: %.2f KSH\n", subtotal);
    printf("Discount Amount: %.2f KSH\n", discount);
    printf("Final Amount Payable: %.2f KSH\n", final_amount);

    return 0;
}

/* Function to calculate the subtotal of five products */
float calculateSubtotal(float p1, float p2, float p3, float p4, float p5)
{
    return p1 + p2 + p3 + p4 + p5;
}

/* Function to calculate the discount based on the subtotal */
float calculateDiscount(float subtotal)
{
    float discount;

    if (subtotal >= 10000)
    {
        discount = subtotal * 0.10;
    }
    else if (subtotal >= 5000)
    {
        discount = subtotal * 0.05;
    }
    else
    {
        discount = 0;
    }

    return discount;
}

/* Function to calculate the final amount payable */
float calculateFinalAmount(float subtotal, float discount)
{
    return subtotal - discount;
}

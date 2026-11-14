/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates e-commerce shipping charges.
- Orders below 500 KSH = 100 KSH shipping fee
- Orders between 500 and 2000 KSH = 50 KSH shipping fee
- Orders above 2000 KSH = Free shipping
- If the item is fragile, add 50 KSH handling fee
*/

#include <stdio.h>

int main()
{
    float order_amount, shippingfee, total_shippingfee;
    char fragile;

    printf("Enter the order amount: ");
    scanf("%f", &order_amount);

    printf("Is the order fragile? (Y/N): ");
    scanf(" %c", &fragile);

    /* Calculate shipping fee */
    if (order_amount < 500)
    {
        shippingfee = 100;
    }
    else if (order_amount <= 2000)
    {
        shippingfee = 50;
    }
    else
    {
        shippingfee = 0;
    }

    /* Add handling fee for fragile items */
    if (fragile == 'Y' || fragile == 'y')
    {
        shippingfee = shippingfee + 50;
    }

    total_shippingfee = shippingfee;

    printf("Order Amount: %.2f KSH\n", order_amount);
    printf("Shipping Fee: %.2f KSH\n", shippingfee);

    if (fragile == 'Y' || fragile == 'y')
    {
        printf("Order Status: Fragile\n");
    }
    else
    {
        printf("Order Status: Not Fragile\n");
    }

    printf("Total Shipping Fee: %.2f KSH\n", total_shippingfee);

    return 0;
}

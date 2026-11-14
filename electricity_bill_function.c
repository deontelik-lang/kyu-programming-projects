/*
NAME: BRAYAN KIHANGA
REG NO: CT100/G/30673/26
DATE: 14/11/26

DESCRIPTION:
A program that calculates an electricity bill using a function.
- First 100 units = KSh 10 per unit
- Next 100 units = KSh 15 per unit
- Above 200 units = KSh 20 per unit
*/

#include <stdio.h>

/* Function prototype */
float calculateElectricBill(float units);

int main()
{
    float units, bill;

    printf("Enter the number of units consumed: ");
    scanf("%f", &units);

    bill = calculateElectricBill(units);

    printf("Total Bill: KSh %.2f\n", bill);

    return 0;
}

/* Function to calculate the electricity bill */
float calculateElectricBill(float units)
{
    float bill;

    if (units <= 100)
    {
        bill = units * 10;
    }
    else if (units <= 200)
    {
        bill = (100 * 10) + ((units - 100) * 15);
    }
    else
    {
        bill = (100 * 10) + (100 * 15) + ((units - 200) * 20);
    }

    return bill;
}
